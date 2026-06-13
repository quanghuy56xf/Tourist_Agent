export type VisitorLocale = "vi" | "en";

export const DEFAULT_LOCALE: VisitorLocale = "vi";
export const LOCALE_STORAGE_KEY = "hera_visitor_locale";

export function normalizeLocale(value: string | null): VisitorLocale {
  return value === "vi" || value === "en" ? value : DEFAULT_LOCALE;
}

export function readStoredLocale(
  storage: Pick<Storage, "getItem">
): VisitorLocale {
  return normalizeLocale(storage.getItem(LOCALE_STORAGE_KEY));
}

export function writeStoredLocale(
  storage: Pick<Storage, "setItem">,
  locale: VisitorLocale
): void {
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function backendLanguageForLocale(
  locale: VisitorLocale
): "Tiếng Việt" | "Tiếng Anh" {
  return locale === "vi" ? "Tiếng Việt" : "Tiếng Anh";
}

const vi = {
  productName: "HERA",
  common: {
    back: "Quay lại",
    close: "Đóng",
    retry: "Thử lại",
    noImage: "Không có ảnh",
  },
  home: {
    siteName: "HERA",
    subtitle: "Khám phá di sản theo cách của riêng bạn",
    audiencePrompt: "Tôi là...",
    familyTitle: "Trẻ em / Gia đình",
    familySubtitle: "Học hỏi và khám phá thật thú vị",
    genZTitle: "Khách khám phá (Gen Z)",
    genZSubtitle: "Khám phá sâu hơn, hiểu hơn, trải nghiệm khác biệt",
    internationalTitle: "Khách quốc tế (International)",
    internationalSubtitle: "Khám phá, học hỏi và trải nghiệm theo cách của bạn",
    start: "BẮT ĐẦU HÀNH TRÌNH →",
    management: "Dành cho Ban quản lý",
    languageLabel: "Ngôn ngữ",
  },
  method: {
    titleLine1: "Bạn muốn tìm hiểu",
    titleLine2: "bằng cách nào?",
    subtitle:
      "Hãy chọn một phương thức bên dưới để bắt đầu khám phá di tích.",
    cameraTitle: "Chụp ảnh trực tiếp",
    cameraSubtitle: "Sử dụng camera để khám phá di tích",
    uploadTitle: "Tải ảnh lên",
    uploadSubtitle: "Chọn ảnh có sẵn từ điện thoại",
    manualTitle: "Chọn thủ công",
    manualSubtitle: "Xem danh sách toàn bộ di tích",
    uploadError: "Lỗi khi tải ảnh lên. Vui lòng thử lại.",
    noMatch:
      "Không nhận diện được vật thể này trong ảnh. Vui lòng thử ảnh khác.",
  },
  scan: {
    instruction: "Hãy hướng camera vào hiện vật và bấm nút chụp",
    capture: "Chụp ảnh",
    scanning: "Bạn chờ chút nhé",
    noMatch:
      "Không nhận diện được vật thể này. Hãy thử lại hoặc chọn thủ công.",
    searchError: "Lỗi khi tìm kiếm. Vui lòng thử lại.",
    cameraPermission: "Không thể truy cập camera. Vui lòng cấp quyền.",
    capturedAlt: "Ảnh vừa chụp",
    hiddenCapture: "Quét vật thể",
  },
  manual: {
    title: "Chọn di tích thủ công",
    empty: "Không có di tích nào trong hệ thống.",
  },
  item: {
    notFound: "Không tìm thấy vật thể",
    loadError: "Không thể tải nội dung",
    contentError: "Không thể sinh nội dung lúc này",
    composing: "Bạn chờ chút nhé",
    confidence: "Độ chính xác",
    noAudio: "Không có âm thanh cho nội dung này",
    audioError: "Không thể phát âm thanh",
    pause: "Tạm dừng",
    listen: "Nghe đoạn văn",
    chatTitle: "Hỏi đáp thêm với HERA",
    answering: "Đang trả lời...",
    chatConnectionError: "Lỗi kết nối. Vui lòng thử lại sau.",
    chatPlaceholder: "Nhập câu hỏi của bạn tại đây...",
    send: "Gửi",
  },
  results: {
    found: "Tìm thấy!",
    suggestions: "Gợi ý vật thể",
    notFound: "Không tìm thấy",
    topMatches: "gần giống nhất",
    match: "khớp",
    explore: "Khám phá với AI",
    noSimilar: "Không tìm thấy vật thể gần giống",
  },
} as const;

type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>;
};

const en: DeepStringShape<typeof vi> = {
  productName: "HERA",
  common: {
    back: "Back",
    close: "Close",
    retry: "Try again",
    noImage: "No image",
  },
  home: {
    siteName: "HERA",
    subtitle: "Explore heritage your way",
    audiencePrompt: "I am...",
    familyTitle: "Children / Family",
    familySubtitle: "Learn and explore through engaging stories",
    genZTitle: "Gen Z Explorer",
    genZSubtitle: "Go deeper, understand more, experience differently",
    internationalTitle: "International Visitor",
    internationalSubtitle: "Discover, learn and experience in your language",
    start: "START YOUR JOURNEY →",
    management: "Management access",
    languageLabel: "Language",
  },
  method: {
    titleLine1: "How would you like",
    titleLine2: "to explore?",
    subtitle: "Choose a method below to start exploring the heritage site.",
    cameraTitle: "Take a photo",
    cameraSubtitle: "Use your camera to explore a heritage object",
    uploadTitle: "Upload a photo",
    uploadSubtitle: "Choose an existing photo from your device",
    manualTitle: "Browse manually",
    manualSubtitle: "View all available heritage objects",
    uploadError: "The photo could not be uploaded. Please try again.",
    noMatch: "We could not identify this object. Please try another photo.",
  },
  scan: {
    instruction: "Point the camera at the object and tap the capture button",
    capture: "Capture",
    scanning: "Please wait a moment",
    noMatch: "We could not identify this object. Try again or browse manually.",
    searchError: "Search failed. Please try again.",
    cameraPermission: "Camera access is unavailable. Please grant permission.",
    capturedAlt: "Captured photo",
    hiddenCapture: "Scan object",
  },
  manual: {
    title: "Browse heritage objects",
    empty: "No heritage objects are available.",
  },
  item: {
    notFound: "Object not found",
    loadError: "Unable to load content",
    contentError: "Unable to generate content right now",
    composing: "Please wait a moment",
    confidence: "Confidence",
    noAudio: "Audio is not available for this content",
    audioError: "Unable to play audio",
    pause: "Pause",
    listen: "Listen",
    chatTitle: "Ask HERA more about this object",
    answering: "Answering...",
    chatConnectionError: "Connection error. Please try again later.",
    chatPlaceholder: "Type your question here...",
    send: "Send",
  },
  results: {
    found: "Match found!",
    suggestions: "Suggested objects",
    notFound: "No match found",
    topMatches: "closest matches",
    match: "match",
    explore: "Explore with AI",
    noSimilar: "No similar object was found",
  },
};

export const translations = { vi, en };
export type VisitorTranslations = DeepStringShape<typeof vi>;
