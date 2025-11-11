from __future__ import annotations

import json
from typing import Any, Optional

import redis.asyncio as aioredis

_redis: Optional[aioredis.Redis] = None


async def init_redis(url: str) -> None:
    """Initialize a module-level Redis client."""
    global _redis
    _redis = aioredis.from_url(url, decode_responses=True)


def _ensure() -> aioredis.Redis:
    """Ensure Redis is initialized."""
    if _redis is None:
        raise RuntimeError("Redis not initialized")
    return _redis


async def cache_get_json(key: str) -> Optional[dict[str, Any]]:
    """Get a JSON payload from Redis."""
    data = await _ensure().get(key)
    return json.loads(data) if data else None


async def cache_set_json(key: str, payload: dict[str, Any], ttl: int) -> None:
    """Set a JSON payload with TTL (seconds)."""
    await _ensure().setex(key, ttl, json.dumps(payload))
