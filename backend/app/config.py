"""应用配置。模型走 OpenAI 兼容接口，全部可通过环境变量覆盖。"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DOCREVIEW_", env_file=str(_ENV_FILE), extra="ignore")

    # 开发服务器（`uv run python -m app` 读取，端口冲突时改 DOCREVIEW_PORT）
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = True

    # 数据库（MVP 用 SQLite，零部署成本）
    database_url: str = "sqlite:///./docreview.db"

    # 文档存储目录（MVP 用本地目录代替对象存储）
    storage_dir: str = "./storage"

    # 模型网关（OpenAI 兼容）。无 key 时流水线自动降级到规则兜底。
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 4096
    llm_timeout: int = 60

    # 异步执行后端：留空=进程内线程(默认,零依赖)；设置=Celery+Redis 跨进程
    celery_broker_url: str = ""
    celery_result_backend: str = ""
    # 流式产出时每条意见之间的间隔(秒)，仅为让前端流式效果可见
    stream_delay: float = 0.05

    cors_origins: str = "http://localhost:5174"


settings = Settings()
