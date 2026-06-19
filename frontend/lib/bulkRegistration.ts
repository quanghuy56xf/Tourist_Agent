export interface BulkFolderItem {
  name: string;
  description: string;
  images: File[];
  validationError: string | null;
}

export function parseDescriptionMap(text: string): Record<string, string> {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("File mô tả phải là một JSON object");
  }

  const descriptions: Record<string, string> = {};
  for (const [name, description] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof description !== "string") {
      throw new Error(`Mô tả của "${name}" phải là chuỗi`);
    }
    descriptions[name.trim()] = description.trim();
  }
  return descriptions;
}

export function groupBulkFiles(
  files: File[],
  descriptions: Record<string, string>
): BulkFolderItem[] {
  const grouped = new Map<string, File[]>();

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const parts = file.webkitRelativePath.split("/").filter(Boolean);
    if (parts.length < 3) continue;
    const itemName = parts[parts.length - 2].trim();
    if (!itemName) continue;
    const current = grouped.get(itemName) ?? [];
    current.push(file);
    grouped.set(itemName, current);
  }

  const itemNames = new Set([...Array.from(grouped.keys()), ...Object.keys(descriptions)]);
  return Array.from(itemNames)
    .sort((left, right) => left.localeCompare(right, "vi"))
    .map((name) => {
      const images = grouped.get(name) ?? [];
      const description = descriptions[name]?.trim() ?? "";
      let validationError: string | null = null;
      if (images.length === 0) validationError = "Thiếu ảnh";
      else if (!description) validationError = "Thiếu mô tả trong file JSON";
      return { name, description, images, validationError };
    });
}
