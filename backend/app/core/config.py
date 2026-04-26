from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Life Ledger MoneyOS API"
    app_version: str = "0.1.0"
    database_url: str = "sqlite:///./life_ledger.db"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")


settings = Settings()
