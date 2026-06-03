"""文档解析：把上传文件转为全文，保留段落级位置。

MVP 支持 .txt / .docx / .pdf（电子版）。扫描件 OCR 放 Phase 2。
"""
from __future__ import annotations

import io
from typing import List, Tuple


def parse_bytes(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".docx"):
        return _parse_docx(data)
    if name.endswith(".pdf"):
        return _parse_pdf(data)
    # 默认按纯文本
    return data.decode("utf-8", errors="ignore")


def _parse_docx(data: bytes) -> str:
    try:
        from docx import Document as Docx
    except ImportError:
        return data.decode("utf-8", errors="ignore")
    doc = Docx(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)


def _parse_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)
