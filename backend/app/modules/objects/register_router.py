import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core import storage
from app.core.database import get_db
from app.modules.auth.dependencies import require_admin_if_enabled
from app.modules.auth.service import ensure_group_access
from app.models.content_variant import ItemContentVariant
from app.models.group import Group
from app.models.item import Item
from app.modules.objects.item_images import ingest_image
from app.modules.content.prewarm import prewarm_item_content
from app.modules.rag.retriever import try_get_rag_retriever
from app.modules.vision import chroma
from app.schemas.register import BulkRegisterResponse, RegisterResponse

router = APIRouter(prefix="/api/objects", tags=["objects"])
logger = logging.getLogger(__name__)


def _resolve_group_id(
    db: Session,
    group_id: int | None,
    new_group_name: str | None,
) -> int | None:
    if new_group_name and new_group_name.strip():
        name = new_group_name.strip()
        group = db.query(Group).filter(Group.name == name).first()
        if group is None:
            group = Group(name=name)
            db.add(group)
            db.flush()
        return group.id

    if group_id is not None:
        group = db.query(Group).filter(Group.id == group_id).first()
        if group is None:
            raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
        return group.id

    return None

@router.post("/bulk-register-item", response_model=BulkRegisterResponse)
async def bulk_register_item(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    description: str = Form(...),
    group_id: int = Form(...),
    images: list[UploadFile] = File(...),
    skip_existing: bool = Form(False),
    dry_run: bool = Form(False),
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    normalized_name = name.strip()
    normalized_description = description.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Tên hiện vật không được để trống")
    if not normalized_description:
        raise HTTPException(status_code=400, detail="Mô tả không được để trống")
    if not images or not any(image.filename for image in images):
        raise HTTPException(status_code=400, detail="Cần ít nhất một ảnh")

    resolved_group_id = _resolve_group_id(db, group_id, None)
    ensure_group_access(staff, resolved_group_id)

    if skip_existing:
        existing = (
            db.query(Item)
            .filter(
                Item.group_id == resolved_group_id,
                Item.name == normalized_name,
            )
            .first()
        )
        if existing is not None:
            return BulkRegisterResponse(
                status="skipped",
                item_id=existing.id,
                message="already_exists",
            )

    if dry_run:
        return BulkRegisterResponse(status="success", message="dry_run")

    item = Item(
        name=normalized_name,
        description=normalized_description,
        group_id=resolved_group_id,
    )
    valid_images = [image for image in images if image.filename]

    try:
        db.add(item)
        db.flush()

        storage.delete_item_dir(item.id)
        chroma.delete_embeddings_for_item(item.id)
        db.query(ItemContentVariant).filter(
            ItemContentVariant.item_id == item.id
        ).delete(synchronize_session=False)

        stored_angles = ("front", "side", "back")
        for index, upload_file in enumerate(valid_images):
            save_to_db = index < len(stored_angles)
            angle = (
                stored_angles[index]
                if save_to_db
                else f"extra_{index - len(stored_angles) + 1}"
            )
            image_url = await ingest_image(
                item.id,
                angle,
                upload_file,
                save_to_db=save_to_db,
            )
            if angle == "front":
                item.main_image_url = image_url

        db.commit()
        db.refresh(item)
    except Exception:
        db.rollback()
        if item.id is not None:
            storage.delete_item_dir(item.id)
            chroma.delete_embeddings_for_item(item.id)
        raise

    try:
        retriever = try_get_rag_retriever()
        if retriever is not None:
            retriever.upsert_item_document(item.id, item.description)
    except Exception as exc:
        logger.warning("Failed to sync bulk registered item to RAG: %s", exc)

    background_tasks.add_task(prewarm_item_content, item.id)
    return BulkRegisterResponse(
        status="success",
        item_id=item.id,
        message="success",
    )

@router.post("/register", response_model=RegisterResponse)
async def register_object(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    description: str = Form(...),
    main_image: UploadFile = File(...),
    side_image: UploadFile | None = File(None),
    back_image: UploadFile | None = File(None),
    group_id: int | None = Form(None),
    new_group_name: str | None = Form(None),
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    if not name.strip():
        raise HTTPException(
            status_code=400,
            detail="Tên hiện vật không được để trống",
        )
    if not description.strip():
        raise HTTPException(
            status_code=400,
            detail="Mô tả không được để trống",
        )
    if not main_image.filename:
        raise HTTPException(
            status_code=400,
            detail="Ảnh mặt trước là bắt buộc",
        )

    if new_group_name and new_group_name.strip() and staff and staff.role == "manager":
        raise HTTPException(
            status_code=403,
            detail="Chỉ admin mới được tạo khu di tích mới",
        )

    resolved_group_id = _resolve_group_id(db, group_id, new_group_name)
    ensure_group_access(staff, resolved_group_id)
    item = Item(
        name=name.strip(),
        description=description.strip(),
        group_id=resolved_group_id,
    )

    try:
        db.add(item)
        db.flush()

        # Remove artifacts left behind if SQLite reuses an item ID.
        storage.delete_item_dir(item.id)
        chroma.delete_embeddings_for_item(item.id)
        db.query(ItemContentVariant).filter(
            ItemContentVariant.item_id == item.id
        ).delete(synchronize_session=False)

        image_pairs: list[tuple[UploadFile, str]] = [(main_image, "front")]
        if side_image and side_image.filename:
            image_pairs.append((side_image, "side"))
        if back_image and back_image.filename:
            image_pairs.append((back_image, "back"))

        for upload_file, angle in image_pairs:
            image_url = await ingest_image(item.id, angle, upload_file)
            if angle == "front":
                item.main_image_url = image_url

        db.commit()
        db.refresh(item)
    except Exception:
        db.rollback()
        if item.id is not None:
            storage.delete_item_dir(item.id)
            chroma.delete_embeddings_for_item(item.id)
        raise

    try:
        retriever = try_get_rag_retriever()
        if retriever is not None:
            retriever.upsert_item_document(item.id, item.description)
    except Exception as exc:
        logger.warning("Failed to sync registered item to RAG: %s", exc)

    background_tasks.add_task(prewarm_item_content, item.id)

    return RegisterResponse(item_id=item.id, message="success")
