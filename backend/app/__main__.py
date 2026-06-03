"""开发入口：从 .env / 环境变量读取 host/port/reload，启动 uvicorn。

    uv run python -m app
"""
import uvicorn

from .config import settings


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    main()
