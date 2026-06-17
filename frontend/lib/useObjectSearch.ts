import { searchObject, type SearchResponse } from "@/lib/api/search";
import { compressImage } from "@/lib/imageCompress";
import { buildSearchTrackingContext, readStoredGroupId } from "@/lib/visitorAnalytics";

type SearchInput = Blob | File;

function toSearchFile(input: SearchInput, filename: string): File {
  if (input instanceof File) return input;
  return new File([input], filename, { type: input.type || "image/jpeg" });
}

export function useObjectSearch() {
  const searchImage = async (
    input: SearchInput,
    filename = "search.jpg"
  ): Promise<SearchResponse> => {
    const file = toSearchFile(input, filename);
    const compressed = await compressImage(file);
    return searchObject(
      compressed,
      buildSearchTrackingContext(readStoredGroupId() ?? undefined)
    );
  };

  return { searchImage };
}
