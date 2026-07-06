"""Bulk ingest local Văn Miếu image folders into item records and embeddings.

The script is an operator tool for rebuilding demo data: it creates or updates items,
stores canonical images, adds extra ChromaDB embeddings, and syncs item text into RAG.
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Thêm thư mục gốc vào sys.path để import được các module của app
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from app.core.database import SessionLocal
from app.models.group import Group
from app.models.item import Item
from app.core.config import USE_AUGMENTATION
from app.modules.vision import chroma, embedding
from app.core import storage
from app.modules.rag.retriever import try_get_rag_retriever

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

ITEM_DESCRIPTIONS = {
    "Bia Tiến sĩ": "Tấm bia đá hình chữ nhật dựng đứng. Màu xám đá hoặc xám xanh. Đặt trên lưng rùa đá lớn. Mặt bia khắc nhiều chữ Hán theo hàng dọc. Kích thước cao hơn người trưởng thành. Xuất hiện thành nhiều cụm bia giống nhau dọc hai bên giếng Thiên Quang. Phần đầu bia thường có hoa văn trang trí. Đặc điểm nhận diện chính: Tấm bia đá lớn đặt trên lưng rùa đá.",
    "Chuông": "Chuông đồng kích thước lớn. Màu nâu đồng hoặc nâu sẫm. Hình trụ loe nhẹ xuống dưới. Treo trong gác hoặc khung gỗ. Bề mặt có hoa văn và chữ khắc nổi. Đỉnh chuông có quai treo. Đặc điểm nhận diện chính: Chuông đồng lớn treo trong khung gỗ.",
    "Cổng chính Văn Miếu": "Cổng tam quan lớn nằm phía trước khu di tích. Tường gạch màu vàng hoặc vàng nâu. Mái ngói truyền thống màu đỏ sẫm. Có ba lối đi, cửa giữa lớn hơn hai cửa bên. Kiến trúc đối xứng. Phía trước thường có khoảng sân rộng và khách tham quan. Đặc điểm nhận diện chính: Cổng tam quan lớn với ba lối đi và mái ngói cổ.",
    "Cổng Đại Trung": "Cổng nằm bên trong khuôn viên Văn Miếu. Kiến trúc ba gian. Mái ngói cong truyền thống. Hai bên có tường gạch kéo dài. Quy mô nhỏ hơn cổng chính. Nằm trên trục chính dẫn vào Khuê Văn Các. Đặc điểm nhận diện chính: Cổng cổ ba gian nằm trên trục trung tâm của Văn Miếu.",
    "Đại Thành Môn": "Cổng dẫn vào khu Đại Thành. Kiến trúc gỗ và mái ngói truyền thống. Quy mô lớn và bề thế. Nằm sau Khuê Văn Các. Có sân rộng phía trước. Trang trí nhiều chi tiết gỗ sơn son. Đặc điểm nhận diện chính: Cổng lớn bằng gỗ nằm trước khu thờ chính.",
    "Đền Khải Thánh": "Công trình kiến trúc truyền thống. Mái ngói đỏ nhiều tầng. Khung gỗ sơn đỏ hoặc nâu đậm. Nằm trong khu vực cuối của Văn Miếu. Có sân gạch phía trước. Cửa chính rộng, bố cục đối xứng. Đặc điểm nhận diện chính: Ngôi đền cổ với mái ngói đỏ và khung gỗ lớn.",
    "Khuê Văn Các": "Công trình hai tầng rất đặc trưng. Tầng dưới gồm bốn trụ gạch vuông màu trắng hoặc xám nhạt. Tầng trên bằng gỗ sơn đỏ. Bốn cửa sổ tròn hình mặt trời nổi bật. Mái ngói đỏ truyền thống. Nằm phía trên lối đi trung tâm. Đặc điểm nhận diện chính: Lầu hai tầng màu đỏ với bốn cửa sổ tròn. Lưu ý: Đây là vật thể dễ nhận diện nhất và nên được ưu tiên thu thập nhiều ảnh nhất.",
    "Trống": "Trống gỗ lớn hình trụ. Hai mặt bọc da màu vàng nhạt hoặc nâu sáng. Thân trống màu đỏ hoặc nâu sẫm. Đặt trên giá đỡ bằng gỗ. Kích thước lớn hơn người. Thường xuất hiện trong khu nhà truyền thống. Đặc điểm nhận diện chính: Trống gỗ lớn đặt trên giá đỡ.",
    "Cổng chính": "Cổng tam quan lớn nằm phía trước khu di tích. Tường gạch màu vàng hoặc vàng nâu. Mái ngói truyền thống màu đỏ sẫm. Có ba lối đi, cửa giữa lớn hơn hai cửa bên. Kiến trúc đối xứng. Phía trước thường có khoảng sân rộng và khách tham quan. Đặc điểm nhận diện chính: Cổng tam quan lớn với ba lối đi và mái ngói cổ.",
}

ANGLE_MAP = ["front", "side", "back"]
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def ingest_image_from_path(item_id: int, angle: str, file_path: Path) -> str:
    content = file_path.read_bytes()
    if not content:
        raise ValueError(f"Image empty: {file_path}")
    vectors = embedding.extract_vectors_augmented(content, augment=USE_AUGMENTATION)
    image_url = storage.save_image_bytes(content, angle, item_id)
    chroma.delete_embedding(item_id, angle)
    chroma.add_embedding(item_id, angle, vectors[0])
    for i, vec in enumerate(vectors[1:], start=1):
        chroma.add_embedding(item_id, f"{angle}_aug{i}", vec)
    return image_url

def ingest_extra_embeddings(item_id: int, file_path: Path, extra_index: int) -> int:
    content = file_path.read_bytes()
    if not content:
        return 0
    vectors = embedding.extract_vectors_augmented(content, augment=USE_AUGMENTATION)
    for i, vec in enumerate(vectors):
        chroma.add_embedding(item_id, f"extra{extra_index}_aug{i}", vec)
    return len(vectors)

def process_folder(db, folder: Path, group: Group, dry_run: bool, skip_existing: bool):
    """Import one artifact folder into the database, vector index, and RAG metadata.

    The first three images become canonical front/side/back images; remaining images are
    embedded as extra recognition views without adding upload records.
    """
    folder_name = folder.name
    image_files = sorted([f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS])
    
    if not image_files:
        logger.warning(f"  [{folder_name}] Không có file ảnh nào.")
        return

    logger.info(f"  [{folder_name}] Tìm thấy {len(image_files)} ảnh.")
    
    if dry_run:
        return

    description = ITEM_DESCRIPTIONS.get(folder_name, f"Vật thể {folder_name} tại Văn Miếu.")
    
    existing = db.query(Item).filter(Item.name == folder_name).first()
    if skip_existing and existing:
        logger.info(f"  [{folder_name}] Đã tồn tại trong DB, bỏ qua (skip_existing=True).")
        return
        
    if existing:
        logger.info(f"  [{folder_name}] Đã tồn tại, đang ghi đè...")
        item = existing
        item.description = description
    else:
        item = Item(name=folder_name, description=description, group_id=group.id)
        db.add(item)
    
    db.flush()

    storage.delete_item_dir(item.id)
    chroma.delete_embeddings_for_item(item.id)

    images_processed = 0
    # Xử lý 3 ảnh đầu
    for i, angle in enumerate(ANGLE_MAP):
        if i >= len(image_files):
            break
        try:
            image_url = ingest_image_from_path(item.id, angle, image_files[i])
            if angle == "front":
                item.main_image_url = image_url
            images_processed += 1
            logger.info(f"    - Đã lưu {angle} image: {image_files[i].name}")
        except Exception as e:
            logger.error(f"    - Lỗi khi lưu {angle} image: {e}")

    # Xử lý ảnh còn lại (vào ChromaDB, không lưu uploads)
    for extra_idx, img_path in enumerate(image_files[3:]):
        try:
            count = ingest_extra_embeddings(item.id, img_path, extra_idx)
            images_processed += 1
            logger.info(f"    - Đã nhúng (embed) extra image: {img_path.name}")
        except Exception as e:
            logger.error(f"    - Lỗi khi nhúng extra image {img_path.name}: {e}")

    # Sync RAG
    try:
        retriever = try_get_rag_retriever()
        if retriever:
            retriever.upsert_item_document(item.id, item.description)
            logger.info(f"    - Đã sync metadata vào RAG.")
    except Exception as e:
        logger.warning(f"    - Lỗi sync RAG: {e}")

    db.commit()
    logger.info(f"  [{folder_name}] Hoàn thành import {images_processed}/{len(image_files)} ảnh.")


def main():
    from app.core.database import init_db
    init_db()

    parser = argparse.ArgumentParser(description="Bulk Ingest DINOv2")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ in log, không thay đổi dữ liệu")
    parser.add_argument("--skip-existing", action="store_true", help="Bỏ qua các folder đã có trong database")
    args = parser.parse_args()

    data_dir = BASE_DIR.parent / "data" / "image"
    if not data_dir.is_dir():
        logger.error(f"Thư mục không tồn tại: {data_dir}")
        return

    subfolders = sorted([d for d in data_dir.iterdir() if d.is_dir()])
    logger.info(f"Tìm thấy {len(subfolders)} subfolders.")

    if args.dry_run:
        logger.info("--- CHẠY DRY RUN ---")

    db = SessionLocal()
    try:
        if not args.dry_run:
            group = db.query(Group).filter(Group.name == "Quốc Tử Giám").first()
            if not group:
                group = Group(name="Quốc Tử Giám")
                db.add(group)
                db.commit()
                db.refresh(group)
        else:
            group = None

        for folder in subfolders:
            process_folder(db, folder, group, args.dry_run, args.skip_existing)
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
