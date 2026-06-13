from pathlib import Path

from app.core.config import BASE_DIR, GROUP_DOCS_DIR


def ensure_group_docs_dir(group_id: int) -> Path:
    path = Path(GROUP_DOCS_DIR) / str(group_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_group_document_file(
    *,
    group_id: int,
    document_id: int,
    extension: str,
    content: bytes,
) -> str:
    directory = ensure_group_docs_dir(group_id)
    filename = f"{document_id}.{extension.lstrip('.')}"
    file_path = directory / filename
    file_path.write_bytes(content)
    return str(file_path.relative_to(BASE_DIR))


def delete_group_document_file(storage_path: str | None) -> None:
    if not storage_path:
        return
    file_path = BASE_DIR / storage_path
    if file_path.is_file():
        file_path.unlink()


def delete_group_documents_dir(group_id: int) -> None:
    directory = Path(GROUP_DOCS_DIR) / str(group_id)
    if not directory.is_dir():
        return
    for child in directory.iterdir():
        if child.is_file():
            child.unlink()
    directory.rmdir()
