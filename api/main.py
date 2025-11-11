from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from core.config import settings
from core.redis import init_redis
from routers.predict import router as predict_router
from routers.history import router as history_router
from routers.indicators import router as indicators_router


def create_app() -> FastAPI:
    """Create and configure FastAPI app with middleware, routes, and rate limiter."""
    limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT])

    app = FastAPI(title="AI Stock Forecast Engine API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.on_event("startup")
    async def _startup() -> None:
        await init_redis(url=settings.REDIS_URL)

    @app.get("/health")
    async def health() -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "ok"}

    # Routers
    app.include_router(predict_router, prefix="/api", tags=["predict"]
    )
    app.include_router(history_router, prefix="/api", tags=["history"]
    )
    app.include_router(indicators_router, prefix="/api", tags=["indicators"]
    )

    return app


app = create_app()
