"""应用配置。模型走 OpenAI 兼容接口，全部可通过环境变量覆盖。"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DOCREVIEW_", env_file=".env", extra="ignore")

    # 数据库（MVP 用 SQLite，零部署成本）
    database_url: str = "sqlite:///./docreview.db"

    # 文档存储目录（MVP 用本地目录代替对象存储）
    storage_dir: str = "./storage"

    # 模型网关（OpenAI 兼容）。无 key 时流水线自动降级到规则兜底。
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 1024
    llm_timeout: int = 60

    cors_origins: str = "http://localhost:5173"


settings = Settings()
