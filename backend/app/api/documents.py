"""文档上传接口。MVP 将文件落本地 storage 目录并解析入库。"""
from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, UploadFile, File
from sqlmodel import Session

from ..config import settings
from ..db import get_session
from ..models import Document
from ..services import parser

router = APIRouter(prefix="/api", tags=["documents"])


@router.post("/documents")
async def upload_document(file: UploadFile = File(...), doc_type: str = "contract",
                          session: Session = Depends(get_session)):
    data = await file.read()
    os.makedirs(settings.storage_dir, exist_ok=True)
    key = f"{uuid.uuid4().hex}_{file.filename}"
    with open(os.path.join(settings.storage_dir, key), "wb") as fp:
        fp.write(data)

    text = parser.parse_bytes(file.filename, data)
    doc = Document(name=file.filename, doc_type=doc_type, storage_key=key, text=text)
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return {"id": doc.id, "name": doc.name, "chars": len(text)}
