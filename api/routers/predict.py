from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from slowapi import Limiter

from core.redis import cache_get_json, cache_set_json
from schemas import PredictResponse
from services.model import predict_future

router = APIRouter()


def rate_limit(request: Request) -> None:
    """Apply IP-based rate limiting at 60 req/min."""
    limiter: Limiter = request.app.state.limiter
    limiter.limit("60/minute")(lambda *_args, **_kwargs: None)(request)  # type: ignore


@router.get("/predict", response_model=PredictResponse)
async def predict_endpoint(
    request: Request,
    ticker: str = Query(..., min_length=1),
    days: int = Query(..., ge=15, le=365),
    asof: Optional[date] = Query(None, description="Freeze date for backtest"),
) -> PredictResponse:
    """
    Predict future prices for a ticker for the next `days` days.

    Optionally provide `asof` to freeze training as-of a historical date (backtest).
    Results cached in Redis for 12h (TTL=43200s).
    """
    rate_limit(request)

    norm_ticker = ticker.upper().strip()
    cache_key = f"predict:{norm_ticker}:{days}" + (f":{asof.isoformat()}" if asof else "" )

    cached = await cache_get_json(cache_key)
    if cached:
        return PredictResponse(**cached)

    try:
        pred = await predict_future(norm_ticker, days, asof)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Prediction failed") from e

    await cache_set_json(cache_key, pred.model_dump(), ttl=43200)
    return pred
