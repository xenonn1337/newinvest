from __future__ import annotations

import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

_redis: Optional[aioredis.Redis] = None
logger = logging.getLogger(__name__)


async def init_redis(url: str) -> None:
    """Initialize a module-level Redis client."""
    global _redis
    try:
        client = aioredis.from_url(url, decode_responses=True)
        await client.ping()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable at %s: %s", url, exc)
        _redis = None
        return
    _redis = client


def _get_client() -> Optional[aioredis.Redis]:
    """Return Redis client if initialized."""

    return _redis


async def cache_get_json(key: str) -> Optional[dict[str, Any]]:
    """Get a JSON payload from Redis."""
    client = _get_client()
    if client is None:
        return None
    data = await client.get(key)
    return json.loads(data) if data else None


async def cache_set_json(key: str, payload: dict[str, Any], ttl: int) -> None:
    """Set a JSON payload with TTL (seconds)."""
    client = _get_client()
    if client is None:
        return
    await client.setex(key, ttl, json.dumps(payload))
