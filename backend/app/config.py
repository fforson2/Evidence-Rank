from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    Supabase and OpenAI values are unused in this milestone. The demo serves
    in-memory fixtures, so the API starts with none of them set. The Supabase
    service-role key is a server secret and must not be exposed to the browser.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    openai_api_key: str = ""

    def origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
