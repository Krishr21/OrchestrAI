from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://orchestrai:orchestrai@localhost:5432/orchestrai"
    redis_url: str = "redis://localhost:6379/0"

    # If empty, we keep tracing local (console exporter).
    otel_exporter_otlp_endpoint: str = ""
    otel_service_name: str = "orchestrai-backend"

    # Feature flag: keep evaluation free/local by default. If enabled, worker will try to run DeepEval
    # which may require extra deps / model config.
    enable_evals: bool = False


settings = Settings()
