from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.item import Item
from app.schemas.group import UngroupedItemsResponse
from app.schemas.object import (
    ImageDeleteResponse,
    ImageUpdateResponse,
    ItemDeleteResponse,
    ItemUpdateRequest,
    ItemUpdateResponse,
)
from app.services import chroma, storage
from app.services.database import get_db
from app.services.groups import get_group_or_404
from app.services.item_images import VALID_ANGLES, ingest_image
from app.services.items import item_to_response

router = APIRouter(prefix="/api/objects", tags=["objects"])


def _get_item_or_404(db: Session, item_id: int) -> Item:
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Vật thể không tồn tại")
    return item


@router.get("/ungrouped", response_model=UngroupedItemsResponse)
def list_ungrouped_items(db: Session = Depends(get_db)):
    items = (
        db.query(Item)
        .filter(Item.group_id.is_(None))
        .order_by(Item.created_at.desc())
        .all()
    )
    return UngroupedItemsResponse(items=[item_to_response(item) for item in items])


@router.put("/{item_id}", response_model=ItemUpdateResponse)
def update_item(
    item_id: int,
    payload: ItemUpdateRequest,
    db: Session = Depends(get_db),
):
    item = _get_item_or_404(db, item_id)

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Tên vật thể không được để trống")
        item.name = name

    if payload.description is not None:
        description = payload.description.strip()
        if not description:
            raise HTTPException(status_code=400, detail="Mô tả không được để trống")
        item.description = description

    if payload.remove_from_group:
        item.group_id = None
    elif payload.group_id is not None:
        get_group_or_404(db, payload.group_id)
        item.group_id = payload.group_id

    db.commit()
    return ItemUpdateResponse(item_id=item.id, message="success")


@router.delete("/{item_id}", response_model=ItemDeleteResponse)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(db, item_id)
    storage.delete_item_dir(item_id)
    chroma.delete_embeddings_for_item(item_id)
    db.delete(item)
    db.commit()
    return ItemDeleteResponse(item_id=item_id, message="success")


@router.put("/{item_id}/images/{angle}", response_model=ImageUpdateResponse)
async def update_item_image(
    item_id: int,
    angle: str,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if angle not in VALID_ANGLES:
        raise HTTPException(status_code=400, detail="Góc ảnh không hợp lệ")
    if not image.filename:
        raise HTTPException(status_code=400, detail="Ảnh là bắt buộc")

    item = _get_item_or_404(db, item_id)
    image_url = await ingest_image(item_id, angle, image)

    if angle == "front":
        item.main_image_url = image_url
        db.commit()

    return ImageUpdateResponse(
        item_id=item_id,
        angle=angle,
        image_url=image_url,
        message="success",
    )


@router.delete("/{item_id}/images/{angle}", response_model=ImageDeleteResponse)
def delete_item_image(
    item_id: int,
    angle: str,
    db: Session = Depends(get_db),
):
    if angle not in VALID_ANGLES:
        raise HTTPException(status_code=400, detail="Góc ảnh không hợp lệ")
    if angle == "front":
        raise HTTPException(
            status_code=400,
            detail="Không thể xóa ảnh mặt trước. Hãy thay ảnh khác.",
        )

    item = _get_item_or_404(db, item_id)
    if not storage.delete_image(item_id, angle):
        raise HTTPException(status_code=404, detail="Ảnh không tồn tại")

    chroma.delete_embedding(item_id, angle)
    db.commit()
    return ImageDeleteResponse(item_id=item_id, angle=angle, message="success")
