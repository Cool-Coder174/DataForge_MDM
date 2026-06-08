"""Minimal HTTP range-request file object so pyarrow can read a remote Parquet
file without downloading the whole thing to disk.

Only the bytes pyarrow asks for (footer + selected row groups) are fetched, which
keeps both disk and bandwidth usage low — handy for large NYC TLC trip files.
"""
from __future__ import annotations

import io

import requests

DEFAULT_TIMEOUT = 60


class HTTPRangeFile(io.RawIOBase):
    def __init__(self, url: str, timeout: int = DEFAULT_TIMEOUT):
        self.url = url
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers["User-Agent"] = "Mozilla/5.0 (DataForge sampler)"
        head = self._session.head(url, allow_redirects=True, timeout=timeout)
        head.raise_for_status()
        self.size = int(head.headers["Content-Length"])
        self._pos = 0

    # --- positioning -------------------------------------------------------
    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            self._pos = offset
        elif whence == io.SEEK_CUR:
            self._pos += offset
        elif whence == io.SEEK_END:
            self._pos = self.size + offset
        return self._pos

    def tell(self) -> int:
        return self._pos

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    # --- reading -----------------------------------------------------------
    def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            size = self.size - self._pos
        if size <= 0 or self._pos >= self.size:
            return b""
        start = self._pos
        end = min(self._pos + size, self.size) - 1
        headers = {"Range": f"bytes={start}-{end}"}
        resp = self._session.get(self.url, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        data = resp.content
        self._pos += len(data)
        return data

    def readinto(self, b) -> int:  # noqa: D401
        data = self.read(len(b))
        n = len(data)
        b[:n] = data
        return n

    def close(self) -> None:
        try:
            self._session.close()
        finally:
            super().close()
