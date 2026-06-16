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
    home: "Trang khu di tích",
    close: "Đóng",
    retry: "Thử lại",
    noImage: "Không có ảnh",
  },
  home: {
    siteName: "HERA",
    headline: "Khám phá Hiện vật",
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
  groups: {
    headline: "Chọn khu di tích",
    subtitle: "Chọn một khu đang mở cho khách tham quan",
    empty: "Hiện chưa có khu di tích nào được công khai.",
    loadError: "Không tải được danh sách khu di tích.",
    itemCount: "hiện vật",
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
    tourTitle: "Tour khám phá",
    tourSubtitle: "Lộ trình gợi ý — chụp đúng hiện vật theo thứ tự",
    uploadError: "Lỗi khi tải ảnh lên. Vui lòng thử lại.",
    noMatch:
      "Không nhận diện được hiện vật này trong ảnh. Vui lòng thử ảnh khác.",
  },
  scan: {
    brand: "HERA Scan",
    headline: "Khám phá Hiện vật",
    instruction: "Hãy hướng camera vào hiện vật và bấm nút chụp",
    capture: "Chụp ảnh",
    scanning: "Bạn chờ chút nhé",
    analyzing: "Đang phân tích...",
    identified: "Đã nhận dạng!",
    noMatch:
      "Không nhận diện được hiện vật này. Hãy thử lại hoặc chọn thủ công.",
    searchError: "Lỗi khi tìm kiếm. Vui lòng thử lại.",
    cameraPermission: "Không thể truy cập camera. Vui lòng cấp quyền.",
    cameraNeedsHttps:
      "Camera chỉ hoạt động qua HTTPS (hoặc localhost). Trên cloud, hãy truy cập bằng https://... thay vì http://IP:3000.",
    capturedAlt: "Ảnh vừa chụp",
    hiddenCapture: "Quét hiện vật",
  },
  manual: {
    catalog: "Danh mục",
    title: "Chọn di tích thủ công",
    empty: "Không có di tích nào trong hệ thống.",
  },
  tour: {
    pageTitle: "Tour khám phá",
    pageSubtitle: "Chọn một lộ trình và khám phá từng di tích theo thứ tự",
    empty: "Chưa có tour gợi ý. Cần ít nhất 2 hiện vật trong hệ thống.",
    stops: "điểm dừng",
    start: "Bắt đầu tour",
    continue: "Tiếp tục tour",
    restart: "Chơi lại từ đầu",
    progress: "Tiến độ",
    stopLabel: "Điểm",
    completed: "Đã hoàn thành",
    currentTarget: "Chụp ảnh hiện vật",
    stepOf: "Bước {current}/{total}",
    wrongStop: "Chưa đúng hiện vật trong tour. Hãy chụp:",
    scanInstruction: "Hướng camera vào hiện vật đúng thứ tự và chụp",
    completeTitle: "Chúc mừng!",
    completeMessage: "Bạn đã hoàn thành tour khám phá",
    completeSummary: "Bạn đã khám phá {count} hiện vật theo đúng lộ trình.",
    backToTours: "Xem tour khác",
    backToMethod: "Về trang chính",
    viewStop: "Xem chi tiết",
    nextStop: "Di tích tiếp theo",
    stopHint: "Gợi ý về di tích",
    showDetails: "Xem thêm",
    hideDetails: "Thu gọn",
    noDescription: "Chưa có mô tả cho hiện vật này.",
  },
  item: {
    objectLabel: "Hiện vật",
    guideSection: "Hướng dẫn viên HERA",
    qaSection: "Hỏi đáp",
    notFound: "Không tìm thấy hiện vật",
    loadError: "Không thể tải nội dung",
    contentError: "Không thể sinh nội dung lúc này",
    composing: "Bạn chờ chút nhé",
    confidence: "Độ chính xác",
    noAudio: "Không có âm thanh cho nội dung này",
    audioError: "Không thể phát âm thanh",
    pause: "Tạm dừng",
    stop: "Dừng",
    resume: "Tiếp tục",
    replay: "Nghe lại",
    listen: "Nghe đoạn văn",
    speakAnswer: "Đọc câu trả lời",
    stopSpeak: "Dừng đọc",
    tapToListen: "Bấm để nghe",
    chatTitle: "Hỏi đáp thêm với HERA",
    answering: "Đang trả lời...",
    chatConnectionError: "Lỗi kết nối. Vui lòng thử lại sau.",
    chatPlaceholder: "Nhập câu hỏi của bạn tại đây...",
    send: "Gửi",
    continueTour: "Di tích tiếp theo trong tour",
  },
  results: {
    found: "Tìm thấy!",
    suggestions: "Gợi ý hiện vật",
    notFound: "Không tìm thấy",
    topMatches: "gần giống nhất",
    match: "khớp",
    explore: "Khám phá với AI",
    noSimilar: "Không tìm thấy hiện vật gần giống",
  },
} as const;

type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>;
};

const en: DeepStringShape<typeof vi> = {
  productName: "HERA",
  common: {
    back: "Back",
    home: "Heritage site home",
    close: "Close",
    retry: "Try again",
    noImage: "No image",
  },
  home: {
    siteName: "HERA",
    headline: "Explore Heritage Objects",
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
  groups: {
    headline: "Choose a heritage site",
    subtitle: "Select a site that is open to visitors",
    empty: "No heritage sites are publicly available yet.",
    loadError: "Could not load heritage sites.",
    itemCount: "objects",
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
    tourTitle: "Exploration tour",
    tourSubtitle: "Suggested routes — scan each stop in order",
    uploadError: "The photo could not be uploaded. Please try again.",
    noMatch: "We could not identify this object. Please try another photo.",
  },
  scan: {
    brand: "HERA Scan",
    headline: "Explore Heritage Objects",
    instruction: "Point the camera at the object and tap the capture button",
    capture: "Capture",
    scanning: "Please wait a moment",
    analyzing: "Analyzing...",
    identified: "Object identified!",
    noMatch: "We could not identify this object. Try again or browse manually.",
    searchError: "Search failed. Please try again.",
    cameraPermission: "Camera access is unavailable. Please grant permission.",
    cameraNeedsHttps:
      "Camera only works over HTTPS (or localhost). On cloud, use https://... instead of http://IP:3000.",
    capturedAlt: "Captured photo",
    hiddenCapture: "Scan object",
  },
  manual: {
    catalog: "Catalog",
    title: "Browse heritage objects",
    empty: "No heritage objects are available.",
  },
  tour: {
    pageTitle: "Exploration tours",
    pageSubtitle: "Pick a route and discover each stop in order",
    empty: "No suggested tours yet. At least 2 objects are required.",
    stops: "stops",
    start: "Start tour",
    continue: "Continue tour",
    restart: "Play again",
    progress: "Progress",
    stopLabel: "Stop",
    completed: "Completed",
    currentTarget: "Scan this object",
    stepOf: "Step {current}/{total}",
    wrongStop: "Wrong stop for this tour. Please scan:",
    scanInstruction: "Point the camera at the correct object and capture",
    completeTitle: "Congratulations!",
    completeMessage: "You completed the exploration tour",
    completeSummary: "You discovered {count} objects in the planned order.",
    backToTours: "Browse other tours",
    backToMethod: "Back to home flow",
    viewStop: "View details",
    nextStop: "Next stop in tour",
    stopHint: "About this heritage object",
    showDetails: "Show more",
    hideDetails: "Show less",
    noDescription: "No description is available for this object yet.",
  },
  item: {
    objectLabel: "Heritage object",
    guideSection: "HERA Guide",
    qaSection: "Q&A",
    notFound: "Object not found",
    loadError: "Unable to load content",
    contentError: "Unable to generate content right now",
    composing: "Please wait a moment",
    confidence: "Confidence",
    noAudio: "Audio is not available for this content",
    audioError: "Unable to play audio",
    pause: "Pause",
    stop: "Stop",
    resume: "Resume",
    replay: "Replay",
    listen: "Listen",
    speakAnswer: "Read answer aloud",
    stopSpeak: "Stop reading",
    tapToListen: "Tap to listen",
    chatTitle: "Ask HERA more about this object",
    answering: "Answering...",
    chatConnectionError: "Connection error. Please try again later.",
    chatPlaceholder: "Type your question here...",
    send: "Send",
    continueTour: "Next stop in tour",
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
