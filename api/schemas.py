from __future__ import annotations

from pydantic import BaseModel


class PredictResponse(BaseModel):
    """Schema for /api/predict response."""
    dates: list[str]
    prices: list[float]
    rmse: float


class Candle(BaseModel):
    """Schema for OHLCV candle."""
    Date: str
    Open: float
    High: float
    Low: float
    Close: float
    Volume: float


class IndicatorsResponse(BaseModel):
    """Schema for indicators."""
    rsi: float
    macd: float
    bb_upper: float
    bb_lower: float
