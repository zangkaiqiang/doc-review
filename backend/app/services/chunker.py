"""切分：把全文按段落/条款切块，每块保留定位锚点（char_start/char_end）。

锚点是「可溯源」的基础——所有意见最终都要映射回这些偏移。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class Chunk:
    seq: int
    text: str
    char_start: int
    char_end: int


def split(full_text: str) -> List[Chunk]:
    chunks: List[Chunk] = []
    cursor = 0
    seq = 0
    for line in full_text.split("\n"):
        start = full_text.find(line, cursor)
        if start == -1:
            start = cursor
        end = start + len(line)
        cursor = end
        if line.strip():
            chunks.append(Chunk(seq=seq, text=line.strip(), char_start=start, char_end=end))
            seq += 1
    return chunks
