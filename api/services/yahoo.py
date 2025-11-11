from __future__ import annotations

from datetime import date
import pandas as pd
import yfinance as yf

from core.config import settings


async def fetch_history(ticker: str, start: date, end: date) -> pd.DataFrame:
    """
    Fetch historical OHLCV using yfinance for a given ticker and date range.
    """
    df = yf.download(
        tickers=ticker,
        start=start.isoformat(),
        end=(end.isoformat()),
        interval=settings.YF_INTERVAL,
        auto_adjust=False,
        progress=False,
        threads=True,
    )
    if df is None or df.empty:
        raise ValueError("No data from Yahoo Finance")
    df = df.dropna()
    if not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.to_datetime(df.index)
    return df
