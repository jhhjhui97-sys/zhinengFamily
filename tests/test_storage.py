from pathlib import Path

import pytest


def test_local_storage_round_trip(tmp_path):
    from smart_home.storage.local import LocalObjectStorage

    storage = LocalObjectStorage(tmp_path / "objects")
    storage.put("merchants/a/example", b"actual asset", "application/octet-stream")
    assert storage.read("merchants/a/example") == b"actual asset"
    assert (tmp_path / "objects/merchants/a/example").read_bytes() == b"actual asset"
    storage.put("merchants/a/example", b"new asset", "application/octet-stream")
    assert storage.read("merchants/a/example") == b"new asset"
    storage.delete("merchants/a/example")
    with pytest.raises(FileNotFoundError):
        storage.read("merchants/a/example")


@pytest.mark.parametrize(
    "key",
    [
        "",
        ".",
        "..",
        "../escape",
        "/absolute",
        "C:/escape",
        "a\\b",
        "a/../b",
        "a//b",
        "a/./b",
        "a/",
        "a:stream",
        "NUL",
        "a\x00b",
    ],
)
@pytest.mark.parametrize("operation", ["put", "read", "delete"])
def test_storage_rejects_unsafe_keys(tmp_path, key, operation):
    from smart_home.storage.local import LocalObjectStorage

    storage = LocalObjectStorage(tmp_path)
    with pytest.raises(ValueError):
        if operation == "put":
            storage.put(key, b"data", "application/octet-stream")
        else:
            getattr(storage, operation)(key)


@pytest.mark.parametrize("operation", ["put", "read", "delete"])
def test_storage_rejects_symlink_escape(tmp_path, operation):
    from smart_home.storage.local import LocalObjectStorage

    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "asset").write_bytes(b"private")
    root = tmp_path / "objects"
    root.mkdir()
    link = root / "link"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except OSError:
        if __import__("os").name == "nt":
            pytest.skip(
                "Windows requires symlink privileges; Linux CI must run this test"
            )
        raise
    storage = LocalObjectStorage(root)
    with pytest.raises(ValueError):
        if operation == "put":
            storage.put("link/asset", b"overwrite", "application/octet-stream")
        else:
            getattr(storage, operation)("link/asset")
    assert Path(outside / "asset").read_bytes() == b"private"
