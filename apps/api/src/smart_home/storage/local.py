from pathlib import Path, PureWindowsPath


class LocalObjectStorage:
    """Private local files; content type is supplied by the owning asset record.

    The root and its parents must not be writable by untrusted OS users.
    Object keys are portable POSIX paths, never client-provided filesystem paths.
    """

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        if not key or any(c in key for c in "\\:\x00"):
            raise ValueError("Invalid object key")
        parts = key.split("/")
        if any(part in ("", ".", "..") for part in parts):
            raise ValueError("Invalid object key")
        if any(PureWindowsPath(part).is_reserved() for part in parts):
            raise ValueError("Reserved object key")
        path = self.root.joinpath(*parts).resolve()
        if path == self.root or not path.is_relative_to(self.root):
            raise ValueError("Object key escapes storage root")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink()
