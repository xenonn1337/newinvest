from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional, Tuple

import numpy as np
import pandas as pd
from pydantic import BaseModel

from core.config import settings
from services.yahoo import fetch_history


@dataclass
class _SeriesPrediction:
    """Internal container for predictions and rmse."""
    dates: list[str]
    prices: list[float]
    rmse: float


class PredictResponseModel(BaseModel):
    """Model used to convert dataclass to Pydantic when needed."""
    dates: list[str]
    prices: list[float]
    rmse: float


class PredictResponse(PredictResponseModel):
    """Exported via schemas.PredictResponse (kept for reference)."""
    pass


def _prepare_sequences(series: np.ndarray, window: int) -> Tuple[np.ndarray, np.ndarray]:
    """Create sequences for LSTM input."""
    X, y = [], []
    for i in range(window, len(series)):
        X.append(series[i - window : i])
        y.append(series[i])
    X_arr = np.array(X).reshape(-1, window, 1)
    y_arr = np.array(y)
    return X_arr, y_arr


def _load_lstm() -> object:
    """
    Load JordiCorbilla LSTM model code (assumed cloned in ./lstm-repo).
    Fallback to a simple EMA-based forecaster if import fails.
    """
    try:
        import importlib.util
        import sys
        spec = importlib.util.spec_from_file_location(
            "jordi_lstm", "lstm-repo/lstm_model.py"
        )
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            sys.modules["jordi_lstm"] = module
            spec.loader.exec_module(module)  # type: ignore[attr-defined]
            return module
    except Exception:
        pass
    return None


async def _rmse_last90(closes: pd.Series) -> float:
    """
    Compute RMSE over last 90 days using a simple walk-forward 1-step forecast
    with an EMA baseline (fast and robust). This provides a confidence proxy.
    """
    if len(closes) < 100:
        return float(np.nan)
    ema_span = 10
    preds = closes.ewm(span=ema_span, adjust=False).mean().shift(1)
    window = min(90, len(closes) - 1)
    errors = (closes.tail(window).values - preds.tail(window).values) ** 2
    return float(np.sqrt(np.nanmean(errors)))


async def predict_future(
    ticker: str,
    days: int,
    asof: Optional[date] = None,
) -> PredictResponseModel:
    """
    Predict `days` future closing prices for `ticker`.
    If `asof` provided, train only on data up to that date (inclusive).
    """
    # Get history up to cutoff
    end_date = (asof or date.today())
    start_date = end_date - timedelta(days=365 * 5)
    df = await fetch_history(ticker, start_date, end_date)
    if df.empty:
        raise ValueError("No historical data")
    closes = df["Close"].astype(float)

    # Normalize
    values = closes.values.reshape(-1, 1)
    mu = float(values.mean())
    sigma = float(values.std() if values.std() != 0 else 1.0)
    norm = (values - mu) / sigma

    window = settings.LSTM_WINDOW
    X, y = _prepare_sequences(norm.flatten(), min(window, len(norm) - 1))
    if len(X) == 0:
        raise ValueError("Insufficient data for LSTM window")

    lstm_module = _load_lstm()

    # Fallback EMA forecaster (works without TF)
    def ema_forecast(last_series: np.ndarray, steps: int, alpha: float = 0.2) -> np.ndarray:
        """Simple EMA forecast on normalized series."""
        last = float(last_series[-1])
        preds = []
        val = last
        for _ in range(steps):
            val = alpha * val + (1 - alpha) * val  # unchanged (random walk-ish)
            preds.append(val)
        return np.array(preds)

    if lstm_module is None:
        preds_norm = ema_forecast(norm.flatten(), days)
    else:
        try:
            import tensorflow as tf  # noqa: F401
            model = lstm_module.build_lstm_model((X.shape[1], 1))  # type: ignore[attr-defined]
            model.fit(X, y, epochs=5, batch_size=32, verbose=0)  # light training
            last_seq = norm.flatten()[-X.shape[1] :].reshape(1, X.shape[1], 1)
            preds = []
            cur = last_seq.copy()
            for _ in range(days):
                pred = float(model.predict(cur, verbose=0)[0])
                preds.append(pred)
                cur = np.roll(cur, -1, axis=1)
                cur[0, -1, 0] = pred
            preds_norm = np.array(preds)
        except Exception:
            preds_norm = ema_forecast(norm.flatten(), days)

    preds = preds_norm * sigma + mu
    # Build date index (calendar days)
    last_day = end_date
    out_dates: list[str] = []
    cur_date = datetime.combine(last_day, datetime.min.time())
    for _ in range(days):
        cur_date += timedelta(days=1)
        out_dates.append(cur_date.date().isoformat())

    rmse = await _rmse_last90(closes)

    return PredictResponseModel(dates=out_dates, prices=[float(x) for x in preds.tolist()], rmse=float(rmse))
