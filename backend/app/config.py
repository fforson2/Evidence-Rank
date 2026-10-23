from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    The demo feed serves in-memory fixtures and starts with none of these set.
    POST /analysis/rank reads OPENAI_API_KEY. There is no user login. The
    Supabase service-role key is a server secret and must not be exposed to the browser.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    rag_top_k: int = 4
    rag_min_score: float = 0.3

    def origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
