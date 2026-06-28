export type CompanionQuestId = "exam-secret" | "four-sacred-beasts";

export type CompanionQuestChoice = {
  id: "A" | "B" | "C";
  label: string;
};

export type CompanionQuestStop = {
  id: string;
  title: string;
  targetKeywords: string[];
  hint: string;
  riddle: string;
  choices: CompanionQuestChoice[];
  correctChoiceId: CompanionQuestChoice["id"];
  explanation: string;
  successLine: string;
};

export type CompanionQuest = {
  id: CompanionQuestId;
  icon: string;
  title: string;
  audience: string;
  concept: string;
  reward: string;
  rewardDescription: string;
  stops: CompanionQuestStop[];
};

export const QUEST_BAIT_TARGET_KEYWORDS = [
  "cổng chính",
  "cong chinh",
  "khuê văn các",
  "khue van cac",
];

export const COMPANION_QUESTS: CompanionQuest[] = [
  {
    id: "exam-secret",
    icon: "🗺️",
    title: "Đi tìm Bí mật Khoa Cử",
    audience: "Học sinh, sinh viên cầu may mắn thi cử",
    concept: "Đôn thử thách bạn xem có đủ tư chất làm Trạng Nguyên không.",
    reward: "Bưu thiếp Đỗ Đạt",
    rewardDescription:
      "Một tấm thẻ lưu niệm chúc bạn đỗ đạt, cưỡi ngựa vinh quy qua Khuê Văn Các.",
    stops: [
      {
        id: "thien-quang-well",
        title: "Giếng Thiên Quang",
        targetKeywords: ["giếng thiên quang", "gieng thien quang", "thiên quang", "thien quang", "giếng", "gieng"],
        hint: "Hãy tìm hồ nước hình vuông nằm giữa hai dãy Bia Tiến sĩ.",
        riddle:
          "Giếng Thiên Quang hình vuông, còn cửa sổ Khuê Văn Các gợi hình tròn. Ẩn ý biểu tượng ở đây là gì?",
        choices: [
          { id: "A", label: "A. Trống và chuông hòa âm" },
          { id: "B", label: "B. Trời tròn, đất vuông" },
          { id: "C", label: "C. Mặt trời và mặt trăng" },
        ],
        correctChoiceId: "B",
        explanation:
          "Giếng hình vuông tượng trưng cho đất, kết hợp với hình tròn của Khuê Văn Các tượng trưng cho trời, thể hiện tinh hoa đất trời và truyền thống hiếu học.",
        successLine: "Tinh mắt lắm! Bạn đã nhìn ra lớp nghĩa ẩn sau kiến trúc.",
      },
      {
        id: "doctor-steles",
        title: "Bia Tiến sĩ",
        targetKeywords: ["bia tiến sĩ", "bia tien si", "bia", "rùa", "rua", "rùa đá", "rua da"],
        hint: "Điểm tiếp theo là hệ thống Bia Tiến sĩ đặt trên lưng rùa đá.",
        riddle:
          "Vì sao tên các vị Tiến sĩ lại được khắc trên bia đá đặt trên lưng rùa?",
        choices: [
          { id: "A", label: "A. Vì rùa chạy nhanh đưa tin chiến thắng" },
          { id: "B", label: "B. Vì rùa tượng trưng cho sự trường tồn của tri thức" },
          { id: "C", label: "C. Vì rùa là linh vật riêng của sĩ tử" },
        ],
        correctChoiceId: "B",
        explanation:
          "Rùa đá tượng trưng cho sự trường tồn. Bia Tiến sĩ ghi danh hiền tài để tôn vinh nhân tài và khuyến khích việc học qua nhiều thế hệ.",
        successLine: "Bạn đã chạm tới bí mật quan trọng của con đường khoa bảng.",
      },
      {
        id: "drum",
        title: "Trống",
        targetKeywords: ["trống", "trong"],
        hint: "Điểm cuối là chiếc Trống - nhạc cụ báo hiệu kỷ luật học tập và các sự kiện quan trọng.",
        riddle:
          "Trong môi trường Nho học xưa, tiếng trống chủ yếu dùng để làm gì?",
        choices: [
          { id: "A", label: "A. Báo hiệu giờ học, kỳ thi hoặc sự kiện quan trọng" },
          { id: "B", label: "B. Gọi quân ra trận trong sân Văn Miếu" },
          { id: "C", label: "C. Báo giờ mở chợ" },
        ],
        correctChoiceId: "A",
        explanation:
          "Tiếng trống dùng để báo hiệu giờ học, kỳ thi và những sự kiện quan trọng, nhắc người học giữ kỷ luật và sự nghiêm túc.",
        successLine: "Bạn đã nghe được nhịp cuối cùng của con đường khoa cử.",
      },
    ],
  },
  {
    id: "four-sacred-beasts",
    icon: "🐉",
    title: "Đánh thức Linh Khí Văn Miếu",
    audience: "Người lớn yêu kiến trúc và văn hóa biểu tượng",
    concept: "Bạn vào vai người giải mã linh khí, tìm các biểu tượng kiến trúc trên trục chính Văn Miếu.",
    reward: "Bưu thiếp Khuê Văn Tỏa Sáng",
    rewardDescription:
      "Một tấm thẻ chúc bạn luôn sáng trí như sao Khuê và bền bỉ trên đường học vấn.",
    stops: [
      {
        id: "main-gate",
        title: "Cổng chính",
        targetKeywords: ["cổng chính", "cong chinh"],
        hint: "Hãy bắt đầu ở Cổng chính - lối vào đầu tiên của Văn Miếu – Quốc Tử Giám.",
        riddle:
          "Cổng chính đánh dấu điều gì trong hành trình tham quan Văn Miếu?",
        choices: [
          { id: "A", label: "A. Sự khởi đầu hành trình khám phá giáo dục và văn hóa Việt Nam" },
          { id: "B", label: "B. Lối ra cuối cùng của khu di tích" },
          { id: "C", label: "C. Nơi tổ chức chợ sách hằng ngày" },
        ],
        correctChoiceId: "A",
        explanation:
          "Cổng chính là lối vào đầu tiên, mở ra hành trình khám phá trường đại học đầu tiên của Việt Nam và truyền thống hiếu học dân tộc.",
        successLine: "Cánh cổng đã mở! Bạn vừa đánh thức điểm khởi đầu của linh khí Văn Miếu.",
      },
      {
        id: "dai-trung-mon",
        title: "Đại Trung Môn",
        targetKeywords: ["đại trung môn", "dai trung mon", "đại trung", "dai trung"],
        hint: "Đi tiếp trên trục chính để tìm Đại Trung Môn - cánh cổng đề cao sự cân bằng và chuẩn mực.",
        riddle:
          "Tên gọi Đại Trung gợi đến tư tưởng nào trong Nho giáo?",
        choices: [
          { id: "A", label: "A. Trung dung, đề cao cân bằng và đạo đức" },
          { id: "B", label: "B. Đi càng nhanh càng tốt" },
          { id: "C", label: "C. Chỉ học võ, không học văn" },
        ],
        correctChoiceId: "A",
        explanation:
          "Đại Trung gắn với tư tưởng trung dung, đề cao sự cân bằng, chuẩn mực và rèn luyện nhân cách của người học.",
        successLine: "Bạn đã giữ được nhịp trung đạo — không vội, không lệch, rất ra dáng người học lễ.",
      },
      {
        id: "khue-van-cac",
        title: "Khuê Văn Các",
        targetKeywords: ["khuê văn các", "khue van cac", "khuê văn", "khue van"],
        hint: "Điểm cuối là Khuê Văn Các - biểu tượng của Hà Nội với tầng trên có các cửa sổ tròn.",
        riddle:
          "Khuê Văn Các gắn với hình ảnh sao Khuê. Sao Khuê đại diện cho điều gì?",
        choices: [
          { id: "A", label: "A. Văn chương, học vấn và trí tuệ" },
          { id: "B", label: "B. Buôn bán và tiền tài" },
          { id: "C", label: "C. Chiến trận và binh khí" },
        ],
        correctChoiceId: "A",
        explanation:
          "Sao Khuê đại diện cho văn chương, học vấn và trí tuệ. Khuê Văn Các vì thế trở thành biểu tượng của tinh thần hiếu học.",
        successLine: "Sao Khuê đã sáng! Bạn đã hoàn thành hành trình đánh thức linh khí Văn Miếu.",
      },
    ],
  },
];

export function normalizeQuestText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function isQuestBaitTarget(itemName: string): boolean {
  const normalized = normalizeQuestText(itemName);
  return QUEST_BAIT_TARGET_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeQuestText(keyword))
  );
}

export function matchQuestStopTarget(
  itemName: string,
  stop: CompanionQuestStop
): boolean {
  const normalized = normalizeQuestText(itemName);
  return stop.targetKeywords.some((keyword) =>
    normalized.includes(normalizeQuestText(keyword))
  );
}

export function getQuestById(id?: string): CompanionQuest | undefined {
  return COMPANION_QUESTS.find((quest) => quest.id === id);
}
