from pathlib import Path

from app.core.config import UPLOAD_DIR

ANGLE_EXTENSIONS = {"front": "jpg", "side": "jpg", "back": "jpg"}
ANGLE_ORDER = ("front", "side", "back")


def ensure_upload_dir() -> Path:
    upload_path = Path(UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


def _versioned_url(item_id: int, filename: str, file_path: Path) -> str:
    version = int(file_path.stat().st_mtime)
    return f"/uploads/{item_id}/{filename}?v={version}"


def save_image_bytes(content: bytes, angle: str, item_id: int) -> str:
    """Save image bytes and return relative URL path with cache-busting version."""
    ensure_upload_dir()
    item_dir = Path(UPLOAD_DIR) / str(item_id)
    item_dir.mkdir(parents=True, exist_ok=True)

    ext = ANGLE_EXTENSIONS.get(angle, "jpg")
    filename = f"{angle}.{ext}"
    file_path = item_dir / filename
    file_path.write_bytes(content)

    return _versioned_url(item_id, filename, file_path)


def list_item_images(item_id: int) -> list[dict[str, str]]:
    item_dir = Path(UPLOAD_DIR) / str(item_id)
    if not item_dir.exists():
        return []

    images: list[dict[str, str]] = []
    for angle in ANGLE_ORDER:
        for ext in ("jpg", "jpeg", "png"):
            file_path = item_dir / f"{angle}.{ext}"
            if file_path.exists():
                images.append(
                    {
                        "angle": angle,
                        "url": _versioned_url(item_id, f"{angle}.{ext}", file_path),
                    }
                )
                break
    return images


def delete_image(item_id: int, angle: str) -> bool:
    item_dir = Path(UPLOAD_DIR) / str(item_id)
    if not item_dir.exists():
        return False

    deleted = False
    for ext in ("jpg", "jpeg", "png"):
        file_path = item_dir / f"{angle}.{ext}"
        if file_path.exists():
            file_path.unlink()
            deleted = True
    return deleted


def delete_item_dir(item_id: int) -> None:
    import shutil

    item_dir = Path(UPLOAD_DIR) / str(item_id)
    if item_dir.exists():
        shutil.rmtree(item_dir)
