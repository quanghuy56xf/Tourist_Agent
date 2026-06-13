import io
from typing import BinaryIO

import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

_model = None
_processor = None
_device = None


def get_device() -> str:
    global _device
    if _device is None:
        _device = "cuda" if torch.cuda.is_available() else "cpu"
    return _device


def get_model():
    """Load DINOv2 ViT-S/14 (384-dim) — equivalent to dinov2_vits14."""
    global _model, _processor
    if _model is None:
        device = get_device()
        _processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
        _model = AutoModel.from_pretrained("facebook/dinov2-small")
        _model.eval()
        _model.to(device)
    return _model, _processor


def warmup() -> None:
    dummy = Image.new("RGB", (224, 224), color=(128, 128, 128))
    extract_vector(dummy)


def _load_image(source: BinaryIO | bytes | Image.Image) -> Image.Image:
    if isinstance(source, Image.Image):
        image = source
    elif isinstance(source, bytes):
        image = Image.open(io.BytesIO(source))
    else:
        image = Image.open(source)
    return image.convert("RGB")


def augment_image(image: Image.Image) -> list[Image.Image]:
    """Tạo biến thể ảnh để tăng khả năng khớp góc chụp khác nhau."""
    w, h = image.size
    variants = [
        image,
        image.transpose(Image.FLIP_LEFT_RIGHT),
    ]
    # Crop vùng giữa 85% — mô phỏng zoom nhẹ khi chụp gần/xa
    if w > 64 and h > 64:
        margin_w = int(w * 0.075)
        margin_h = int(h * 0.075)
        variants.append(image.crop((margin_w, margin_h, w - margin_w, h - margin_h)))
    return variants


def extract_vector(image: Image.Image) -> list[float]:
    """Extract a 384-dim L2-normalized embedding from a PIL image."""
    model, processor = get_model()
    device = get_device()

    inputs = processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)
        features = outputs.last_hidden_state[:, 0]
        features = torch.nn.functional.normalize(features, p=2, dim=1)

    return features.squeeze(0).cpu().tolist()


def extract_vector_from_source(source: BinaryIO | bytes | Image.Image) -> list[float]:
    image = _load_image(source)
    return extract_vector(image)


def extract_vectors_batch(images: list[Image.Image]) -> list[list[float]]:
    """Trích xuất danh sách vector từ một batch ảnh bằng DINOv2 trong một lần chạy duy nhất."""
    if not images:
        return []
    model, processor = get_model()
    device = get_device()

    inputs = processor(images=images, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)
        features = outputs.last_hidden_state[:, 0]
        features = torch.nn.functional.normalize(features, p=2, dim=1)

    return features.cpu().tolist()


def extract_vectors_augmented(
    source: BinaryIO | bytes | Image.Image,
    augment: bool = True,
) -> list[list[float]]:
    """Trích xuất nhiều vector từ ảnh gốc và các biến thể."""
    image = _load_image(source)
    variants = augment_image(image) if augment else [image]
    return extract_vectors_batch(variants)
