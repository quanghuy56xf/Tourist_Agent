from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.item import Item
from app.schemas.register import RegisterResponse
from app.services import storage
from app.services.database import get_db
from app.services.groups import resolve_group_id
from app.services.item_images import ingest_image

router = APIRouter(prefix="/api/objects", tags=["objects"])


@router.post("/register", response_model=RegisterResponse)
async def register_object(
    name: str = Form(...),
    description: str = Form(...),
    main_image: UploadFile = File(...),
    side_image: UploadFile | None = File(None),
    back_image: UploadFile | None = File(None),
    group_id: int | None = Form(None),
    new_group_name: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if not name.strip():
        raise HTTPException(status_code=400, detail="Tên vật thể không được để trống")
    if not description.strip():
        raise HTTPException(status_code=400, detail="Mô tả không được để trống")
    if not main_image.filename:
        raise HTTPException(status_code=400, detail="Ảnh mặt trước là bắt buộc")

    resolved_group_id = resolve_group_id(db, group_id, new_group_name)

    item = Item(
        name=name.strip(),
        description=description.strip(),
        group_id=resolved_group_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Tránh ảnh cũ sót lại nếu ID bị tái sử dụng
    storage.delete_item_dir(item.id)

    image_pairs: list[tuple[UploadFile, str]] = [(main_image, "front")]
    if side_image and side_image.filename:
        image_pairs.append((side_image, "side"))
    if back_image and back_image.filename:
        image_pairs.append((back_image, "back"))

    main_image_url = None
    for upload_file, angle in image_pairs:
        image_url = await ingest_image(item.id, angle, upload_file)
        if angle == "front":
            main_image_url = image_url

    if main_image_url:
        item.main_image_url = main_image_url
        db.commit()

    return RegisterResponse(item_id=item.id, message="success")
