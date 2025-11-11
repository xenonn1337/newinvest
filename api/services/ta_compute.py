from __future__ import annotations

from datetime import date, timedelta
from pydantic import BaseModel
import pandas as pd

from services.yahoo import fetch_history


class IndicatorsOut(BaseModel):
    """Pydantic model for indicators endpoint."""
    rsi: float
    macd: float
    bb_upper: float
    bb_lower: float


def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Compute RSI using Wilder's smoothing."""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0.0)).abs()
    loss = (-delta.where(delta < 0, 0.0)).abs()

    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def _ema(series: pd.Series, span: int) -> pd.Series:
    """Exponential moving average helper."""
    return series.ewm(span=span, adjust=False).mean()


def _macd_hist(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.Series:
    """MACD histogram (MACD line minus signal)."""
    macd_line = _ema(series, fast) - _ema(series, slow)
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return hist


def _bollinger(series: pd.Series, length: int = 20, std_mult: float = 2.0) -> tuple[pd.Series, pd.Series]:
    """Bollinger Bands (upper, lower)."""
    ma = series.rolling(window=length, min_periods=length).mean()
    sd = series.rolling(window=length, min_periods=length).std(ddof=0)
    upper = ma + std_mult * sd
    lower = ma - std_mult * sd
    return upper, lower


async def latest_indicators(ticker: str) -> IndicatorsOut:
    """
    Compute latest RSI(14), MACD(12,26,9) histogram, and Bollinger Bands(20,2).
    """
    end = date.today()
    start = end - timedelta(days=365)
    df = await fetch_history(ticker, start, end)
    closes = df["Close"].astype(float)

    rsi_series = _rsi(closes, period=14)
    macd_series = _macd_hist(closes, fast=12, slow=26, signal=9)
    bb_upper, bb_lower = _bollinger(closes, length=20, std_mult=2.0)

    rsi_val = float(rsi_series.dropna().iloc[-1])
    macd_hist = float(macd_series.dropna().iloc[-1])
    bb_u = float(bb_upper.dropna().iloc[-1])
    bb_l = float(bb_lower.dropna().iloc[-1])

    return IndicatorsOut(rsi=rsi_val, macd=macd_hist, bb_upper=bb_u, bb_lower=bb_l)
