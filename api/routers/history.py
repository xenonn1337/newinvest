from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, HTTPException, Query, status

from schemas import Candle
from services.yahoo import fetch_history

router = APIRouter()


@router.get("/history", response_model=List[Candle])
async def history_endpoint(
    ticker: str = Query(..., min_length=1),
    start: date = Query(...),
    end: date = Query(...),
) -> list[Candle]:
    """
    Return OHLCV candles between start and end (inclusive of start, exclusive of end+1).
    """
    try:
        df = await fetch_history(ticker.upper(), start, end)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="History fetch failed") from e
    return [
        Candle(
            Date=str(idx.date()),
            Open=float(row["Open"]),
            High=float(row["High"]),
            Low=float(row["Low"]),
            Close=float(row["Close"]),
            Volume=float(row["Volume"]),
        )
        for idx, row in df.iterrows()
    ]
