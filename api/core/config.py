from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    REDIS_URL: str = "redis://localhost:6379/0"
    ALLOW_ORIGINS: List[str] = ["*"]
    RATE_LIMIT: str = "60/minute"

    YF_INTERVAL: str = "1d"
    YF_PERIOD: str = "5y"

    # ML params
    LSTM_WINDOW: int = 60

    class Config:
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
