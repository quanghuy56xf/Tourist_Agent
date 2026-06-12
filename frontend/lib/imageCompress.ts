const MAX_SIZE = 800;
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let newWidth = width;
  let newHeight = height;

  if (width > MAX_SIZE || height > MAX_SIZE) {
    if (width > height) {
      newWidth = MAX_SIZE;
      newHeight = Math.round((height / width) * MAX_SIZE);
    } else {
      newHeight = MAX_SIZE;
      newWidth = Math.round((width / height) * MAX_SIZE);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Không thể nén ảnh"));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}
