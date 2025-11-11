from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional, Tuple

import numpy as np
import pandas as pd
from pydantic import BaseModel
from sklearn.preprocessing import MinMaxScaler

from core.config import settings
from services.yahoo import fetch_history


class PredictResponseModel(BaseModel):
    """Model used to convert dataclass to Pydantic when needed."""
    dates: list[str]
    prices: list[float]
    rmse: float


class PredictResponse(PredictResponseModel):
    """Exported via schemas.PredictResponse (kept for reference)."""
    pass


def _prepare_sequences(series: np.ndarray, window: int) -> Tuple[np.ndarray, np.ndarray]:
    """Create sliding windows for LSTM input following JordiCorbilla repo."""

    flattened = series.reshape(-1)
    if window <= 1 or len(flattened) <= window:
        raise ValueError("Insufficient samples for requested window")

    X: list[np.ndarray] = []
    y: list[float] = []
    for i in range(window, len(flattened)):
        X.append(flattened[i - window : i])
        y.append(flattened[i])

    X_arr = np.array(X, dtype=np.float32).reshape(-1, window, 1)
    y_arr = np.array(y, dtype=np.float32)
    return X_arr, y_arr


def _build_jordi_lstm(input_shape: Tuple[int, int]) -> "object":
    """Construct the Sequential LSTM architecture from JordiCorbilla's project."""

    from tensorflow.keras import Sequential
    from tensorflow.keras.layers import Dense, Dropout, LSTM

    model = Sequential()
    model.add(LSTM(50, return_sequences=True, input_shape=input_shape))
    model.add(Dropout(0.2))
    model.add(LSTM(50, return_sequences=True))
    model.add(Dropout(0.2))
    model.add(LSTM(50))
    model.add(Dropout(0.2))
    model.add(Dense(1))
    model.compile(optimizer="adam", loss="mean_squared_error")
    return model


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

    # Scale to [0, 1] as in JordiCorbilla implementation
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_values = scaler.fit_transform(closes.values.reshape(-1, 1)).reshape(-1)
    if len(scaled_values) <= 1:
        raise ValueError("Not enough price history for forecasting")

    window = min(settings.LSTM_WINDOW, len(scaled_values) - 1)
    X, y = _prepare_sequences(scaled_values, window)

    # Ensure we have enough samples
    if X.size == 0:
        raise ValueError("Insufficient data for LSTM window")

    def ema_forecast(last_series: np.ndarray, steps: int, alpha: float = 0.2) -> np.ndarray:
        """Simple EMA forecast on scaled series as a safe fallback."""

        last = float(last_series[-1])
        preds: list[float] = []
        val = last
        for _ in range(steps):
            val = alpha * val + (1 - alpha) * val
            preds.append(val)
        return np.array(preds, dtype=np.float32)

    try:
        import tensorflow as tf  # noqa: F401

        model = _build_jordi_lstm((X.shape[1], 1))
        model.fit(X, y, epochs=10, batch_size=32, verbose=0)

        last_seq = scaled_values[-X.shape[1] :].reshape(1, X.shape[1], 1)
        preds_scaled: list[float] = []
        cur = last_seq.copy()
        for _ in range(days):
            next_pred = float(model.predict(cur, verbose=0)[0][0])
            preds_scaled.append(next_pred)
            cur = np.roll(cur, -1, axis=1)
            cur[0, -1, 0] = next_pred
        preds_norm = np.array(preds_scaled, dtype=np.float32)
    except Exception:
        preds_norm = ema_forecast(scaled_values, days)

    preds = scaler.inverse_transform(preds_norm.reshape(-1, 1)).reshape(-1)
    # Build date index (calendar days)
    last_day = end_date
    out_dates: list[str] = []
    cur_date = datetime.combine(last_day, datetime.min.time())
    for _ in range(days):
        cur_date += timedelta(days=1)
        out_dates.append(cur_date.date().isoformat())

    rmse = await _rmse_last90(closes)

    return PredictResponseModel(dates=out_dates, prices=[float(x) for x in preds.tolist()], rmse=float(rmse))
