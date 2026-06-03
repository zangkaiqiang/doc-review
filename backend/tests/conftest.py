"""测试隔离：用独立 sqlite 文件，避免污染开发库。

env 必须在导入 app（进而实例化 settings/engine）之前设置。
"""
import os
import pathlib
import tempfile

_DB = pathlib.Path(tempfile.gettempdir()) / "docreview_pytest.db"
if _DB.exists():
    _DB.unlink()
os.environ["DOCREVIEW_DATABASE_URL"] = f"sqlite:///{_DB}"

# 建表：模块级 TestClient(app) 不会触发 lifespan startup（Starlette 0.38），
# 这里在 env 指向隔离库之后显式建表，保证用例运行前 schema 就绪。
from app.db import init_db  # noqa: E402  (env 必须先于 import app 设置)

init_db()
