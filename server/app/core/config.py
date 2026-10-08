import secrets

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    env: str = "local"
    secret_key: str | None = Field(default=None, min_length=32)
    database_url: str = "postgresql+psycopg://bob:bob@localhost:5432/bob"
    access_token_expire_minutes: int = Field(default=30, gt=0)
    cors_origins: str = "http://localhost:5173"
    solver_processes: int = Field(default=4, ge=0)  # 0 or 1 solves in-process
    solver_disabled: bool = False  # demo switch: no plans, so BOB falls back to safe hold
    # BOB's language model (Azure OpenAI). Without an endpoint and key, every decision uses the rules.
    microsoft_azure_openai_endpoint: str | None = None
    microsoft_azure_openai_key: str | None = None
    microsoft_azure_openai_deployment_name: str | None = None
    bob_enabled: bool = True
    bob_timeout_s: float = Field(default=20.0, gt=0)  # a cycle turn
    bob_chat_timeout_s: float = Field(default=25.0, gt=0)  # the client gives up after 30 s
    bob_max_tool_calls: int = Field(default=8, gt=0)

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", env_ignore_empty=True, extra="ignore"
    )

    @model_validator(mode="after")
    def require_secret_outside_local(self) -> "Settings":
        if self.secret_key is None:
            if self.env != "local":
                raise ValueError("SECRET_KEY is required when ENV is not 'local'")
            # Local only: tokens stop working when the API restarts.
            self.secret_key = secrets.token_urlsafe(32)
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
