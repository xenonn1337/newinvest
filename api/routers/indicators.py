from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from schemas import IndicatorsResponse
from services.ta_compute import latest_indicators

router = APIRouter()


@router.get("/indicators", response_model=IndicatorsResponse)
async def indicators_endpoint(ticker: str = Query(..., min_length=1)) -> IndicatorsResponse:
    """
    Compute latest RSI, MACD histogram, Bollinger Bands (upper/lower) for the ticker.
    """
    try:
        result = await latest_indicators(ticker.upper())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Indicator compute failed") from e
    return result
