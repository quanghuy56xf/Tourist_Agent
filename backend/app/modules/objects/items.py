from app.models.item import Item
from app.schemas.group import GroupItemResponse, ItemImageResponse
from app.core import storage


def item_to_response(item: Item, sync_state: str | None = None) -> GroupItemResponse:
    images = storage.list_item_images(item.id)
    main_image_url = item.main_image_url
    front = next((img for img in images if img["angle"] == "front"), None)
    if front:
        main_image_url = front["url"]

    return GroupItemResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        main_image_url=main_image_url,
        group_id=item.group_id,
        images=[
            ItemImageResponse(angle=img["angle"], url=img["url"])
            for img in images
        ],
        created_at=item.created_at,
        sync_state=sync_state,
    )
