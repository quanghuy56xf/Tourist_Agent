# Hướng Dẫn Thu Thập Ảnh Data – MVP AI Heritage Guide

> **Mục tiêu**: Nhận diện chính xác **5 địa điểm** tại Văn Miếu – Quốc Tử Giám  
> **Model**: Gemini 2.5 Flash (multimodal LLM, không cần training)  
> **Target Accuracy**: ≥ 85%

---

## ⚡ Điểm Quan Trọng: Gemini KHÔNG Cần Training Data

Khác với ML truyền thống, Gemini 2.5 Flash **đã biết** nhận diện qua knowledge sẵn có.  
Ảnh bạn thu thập phục vụ **3 mục đích khác nhau**, không phải để train model:

| Loại ảnh | Mục đích | Số lượng |
|----------|----------|----------|
| **Reference Images** | Ảnh mẫu đẹp gửi kèm prompt (few-shot) để tăng accuracy | 3-5 ảnh/landmark |
| **Test Images** | Ảnh kiểm tra accuracy của hệ thống | 20-30 ảnh/landmark |
| **Knowledge Base** | Ảnh minh họa hiển thị trong UI cho user xem | 2-3 ảnh/landmark |

> [!IMPORTANT]
> **Tổng ảnh cần: ~150-200 ảnh** (không phải 600 ảnh như PRD gốc). Vì Gemini không cần training, bạn tiết kiệm rất nhiều effort thu thập.

---

## 📸 5 Landmark Cần Thu Thập

### 1. Khuê Văn Các (Constellation of Literature Pavilion)

**Đặc điểm nhận dạng chính:**
- Lầu vuông 2 tầng, **8 mái** (4 trên + 4 dưới)
- 4 cửa sổ hình tròn tỏa tia sáng (biểu tượng sao Khuê)
- 4 trụ gạch vuông tầng dưới, gỗ sơn son tầng trên
- Nền gạch Bát Tràng cao

**Checklist chụp ảnh:**

| # | Góc chụp | Mô tả | Ưu tiên |
|---|----------|-------|---------|
| 1 | Chính diện gần (5-10m) | Thấy rõ toàn bộ cấu trúc 2 tầng | ⭐ Reference |
| 2 | Chính diện xa (20-30m) | Toàn cảnh có sân + đường dẫn | ⭐ Reference |
| 3 | Góc nghiêng 45° trái | Thấy 2 mặt của lầu | Test |
| 4 | Góc nghiêng 45° phải | Thấy 2 mặt khác | Test |
| 5 | Từ xa qua hồ Thiên Quang | Phản chiếu trên mặt nước | Test |
| 6 | Close-up cửa sổ tròn | Chi tiết đặc trưng nhất | ⭐ Reference |
| 7 | Có người đi lại | Test khả năng nhận diện khi có nhiễu | Test |
| 8 | Backlit (ngược sáng) | Test điều kiện ánh sáng khó | Test |

---

### 2. Bia Tiến Sĩ (Doctoral Steles)

**Đặc điểm nhận dạng chính:**
- 82 tấm bia đá đặt trên **lưng rùa đá**
- Bia dẹt, trán cong hình vòm
- Xếp thành hàng dọc 2 bên giếng Thiên Quang
- Nhà bia mái ngói che phía trên

**Checklist chụp ảnh:**

| # | Góc chụp | Mô tả | Ưu tiên |
|---|----------|-------|---------|
| 1 | Toàn cảnh dãy bia (xa) | Nhiều bia + nhà bia + giếng | ⭐ Reference |
| 2 | Nhóm 3-5 bia (trung) | Thấy rõ cấu trúc bia + rùa | ⭐ Reference |
| 3 | Close-up 1 tấm bia | Chi tiết chữ khắc + hoa văn | ⭐ Reference |
| 4 | Close-up rùa đá | Đặc trưng nhận dạng | Test |
| 5 | Góc nghiêng dãy bia | Perspective dài | Test |
| 6 | Bia có du khách đứng cạnh | Test với người trong khung hình | Test |
| 7 | Chụp từ nhà bia nhìn ra | Góc ngược | Test |
| 8 | Bia dưới ánh nắng xiên | Test lighting conditions | Test |

---

### 3. Đại Thành Môn (Gate of Great Success)

**Đặc điểm nhận dạng chính:**
- Cổng kiến trúc truyền thống, mái cong
- Cột gỗ lim lớn
- Lối vào trang nghiêm dẫn tới khu điện thờ Khổng Tử
- Có bậc thang đá phía trước

**Checklist chụp ảnh:**

| # | Góc chụp | Mô tả | Ưu tiên |
|---|----------|-------|---------|
| 1 | Chính diện (trước cổng) | Toàn bộ cổng + mái cong | ⭐ Reference |
| 2 | Chính diện từ trong nhìn ra | Góc ngược từ sân trong | ⭐ Reference |
| 3 | Close-up mái ngói cong | Chi tiết kiến trúc mái | Test |
| 4 | Góc nghiêng 30° | Thấy độ sâu cổng | Test |
| 5 | Close-up cửa gỗ | Chi tiết vân gỗ, chạm khắc | Test |
| 6 | Toàn cảnh có sân 2 bên | Bối cảnh rộng | ⭐ Reference |
| 7 | Lúc đông khách | Test nhiễu người | Test |

---

### 4. Nhà Thái Học (Thai Hoc House)

**Đặc điểm nhận dạng chính:**
- Công trình phục dựng (2000), kết cấu hình chữ "Công"
- Mái lợp ngói mũi hài
- Bộ vì đỡ mái kiểu "chồng rường"
- Sân rộng phía trước, trưng bày bên trong

**Checklist chụp ảnh:**

| # | Góc chụp | Mô tả | Ưu tiên |
|---|----------|-------|---------|
| 1 | Chính diện sân ngoài | Toàn cảnh mặt tiền | ⭐ Reference |
| 2 | Nội thất bên trong | Không gian trưng bày | ⭐ Reference |
| 3 | Close-up mái ngói mũi hài | Đặc trưng kiến trúc | Test |
| 4 | Close-up cấu trúc gỗ | Bộ vì "chồng rường" | Test |
| 5 | Góc nghiêng ngoại thất | Thấy chiều dài tòa nhà | ⭐ Reference |
| 6 | Từ xa (toàn cảnh + sân) | Bối cảnh rộng | Test |
| 7 | Ban đêm/chiều muộn | Test low-light | Test |

---

### 5. Hồ Văn (Literature Lake)

**Đặc điểm nhận dạng chính:**
- Hồ nước lớn đối diện cổng chính Văn Miếu
- Gò Kim Châu nổi giữa hồ
- Phương đình (nhà nhỏ) trên gò
- Bờ hồ có cây xanh bao quanh

**Checklist chụp ảnh:**

| # | Góc chụp | Mô tả | Ưu tiên |
|---|----------|-------|---------|
| 1 | Toàn cảnh từ bờ (rộng) | Hồ + gò Kim Châu + Phương đình | ⭐ Reference |
| 2 | Hướng về gò Kim Châu | Zoom trung vào gò và đình | ⭐ Reference |
| 3 | Từ cổng Văn Miếu nhìn ra | Ngược hướng, thấy hồ phía xa | Test |
| 4 | Góc dọc bờ hồ | Perspective dài bờ hồ | Test |
| 5 | Phản chiếu trên mặt nước | Ảnh nghệ thuật + test pattern | Test |
| 6 | Trời âm u/mưa | Test thời tiết xấu | Test |
| 7 | Close-up Phương đình | Chi tiết kiến trúc trên gò | ⭐ Reference |

---

## 📋 Tiêu Chuẩn Kỹ Thuật Ảnh

### Yêu cầu bắt buộc

| Tiêu chí | Yêu cầu | Lý do |
|----------|---------|-------|
| **Định dạng** | JPEG hoặc PNG | Gemini API hỗ trợ |
| **Kích thước** | ≤ 5MB/ảnh | Giới hạn FR-03 trong PRD |
| **Độ phân giải** | Tối thiểu 1280×720px | Đủ chi tiết để nhận diện |
| **Tối đa** | 4096×4096px | Giới hạn Gemini API |
| **Orientation** | Landscape (ngang) ưu tiên | Phù hợp mobile viewport |
| **Nét** | Không bị blur/nhòe | Ảnh blur → Gemini khó nhận diện |

### Điều kiện chụp đa dạng

```
Thời gian trong ngày:
  ☀️ Sáng (8-10h)     → Ánh sáng đẹp, ít bóng
  🌤️ Trưa (11-13h)    → Nắng gắt, bóng đổ mạnh  
  🌅 Chiều (15-17h)    → Ánh sáng vàng, ngược sáng
  🌙 Chiều muộn (17-18h) → Low-light, test khó

Thời tiết:
  ☀️ Nắng đẹp          → Baseline accuracy
  ☁️ Trời âm u         → Màu sắc trầm hơn
  🌧️ Sau mưa           → Mặt đất ướt, phản chiếu

Điều kiện nhiễu:
  👥 Có du khách        → Test real-world conditions
  🌳 Cây che khuất      → Test partial occlusion
  📱 Chụp bằng phone    → Test chất lượng camera thực tế
```

---

## 📁 Cấu Trúc Thư Mục Lưu Trữ

```
van_mieu_dataset/
├── reference/                    ← Ảnh mẫu gửi kèm prompt (few-shot)
│   ├── khue_van_cac/
│   │   ├── ref_01_front.jpg
│   │   ├── ref_02_wide.jpg
│   │   └── ref_03_detail.jpg
│   ├── bia_tien_si/
│   │   ├── ref_01_overview.jpg
│   │   ├── ref_02_group.jpg
│   │   └── ref_03_closeup.jpg
│   ├── dai_thanh_mon/
│   ├── nha_thai_hoc/
│   └── ho_van/
│
├── test/                         ← Ảnh kiểm tra accuracy
│   ├── khue_van_cac/
│   │   ├── test_01_angle45.jpg
│   │   ├── test_02_backlit.jpg
│   │   ├── test_03_crowd.jpg
│   │   └── ...
│   ├── bia_tien_si/
│   ├── dai_thanh_mon/
│   ├── nha_thai_hoc/
│   ├── ho_van/
│   └── negative/                 ← Ảnh KHÔNG phải 5 landmark (xe, cây, người...)
│       ├── neg_01_tree.jpg
│       ├── neg_02_parking.jpg
│       └── ...
│
├── ui_display/                   ← Ảnh đẹp hiển thị trong app
│   ├── khue_van_cac_thumb.jpg
│   ├── bia_tien_si_thumb.jpg
│   └── ...
│
└── metadata.json                 ← Thông tin về từng ảnh
```

---

## 📄 Metadata File Format

Tạo file `metadata.json` để track thông tin ảnh:

```json
{
  "dataset_version": "1.0",
  "location": "Văn Miếu – Quốc Tử Giám, Hà Nội",
  "landmarks": [
    {
      "id": "khue_van_cac",
      "name_vi": "Khuê Văn Các",
      "name_en": "Constellation of Literature Pavilion",
      "reference_images": ["reference/khue_van_cac/ref_01_front.jpg"],
      "test_images": [
        {
          "path": "test/khue_van_cac/test_01_angle45.jpg",
          "conditions": {
            "angle": "45_degree_left",
            "lighting": "morning_sun",
            "occlusion": "none",
            "crowd": false,
            "device": "iPhone 15"
          },
          "expected_result": {
            "name": "Khuê Văn Các",
            "min_confidence": 70
          }
        }
      ]
    }
  ]
}
```

---

## 🧪 Quy Trình Kiểm Tra Accuracy

### Bước 1: Chụp ảnh test (Tuần 2-3)

Thu thập đủ ảnh theo checklist trên. Ưu tiên:
1. Chụp bằng **điện thoại thực tế** (không phải máy ảnh chuyên nghiệp)
2. Chụp như một **du khách bình thường** sẽ chụp
3. Không chỉnh sửa, filter, crop – giữ nguyên ảnh gốc

### Bước 2: Test trên Google AI Studio (Tuần 3)

Trước khi code, test thủ công trên [Google AI Studio](https://aistudio.google.com):

```
Bước 2a: Mở AI Studio → chọn Gemini 2.5 Flash
Bước 2b: Upload 3 reference images (few-shot examples)
Bước 2c: Upload 1 test image
Bước 2d: Dùng prompt bên dưới
Bước 2e: Ghi nhận kết quả vào bảng tracking
```

**Prompt mẫu để test:**

```
You are an AI heritage guide for Văn Miếu – Quốc Tử Giám (Temple of Literature) 
in Hanoi, Vietnam. Your task is to identify the specific landmark in a photo.

The 5 supported landmarks are:
1. Khuê Văn Các (Constellation of Literature Pavilion) - Square two-story pavilion 
   with 8 curved roofs, 4 round windows radiating light patterns, brick pillars below
2. Bia Tiến Sĩ (Doctoral Steles) - Stone steles on stone turtle pedestals, arranged 
   in rows beside Thien Quang well, covered by shelter roofs
3. Đại Thành Môn (Gate of Great Success) - Traditional Vietnamese gate with curved 
   roof, large wooden columns, stone steps leading to Confucius worship area
4. Nhà Thái Học (Thai Hoc House) - Large reconstructed building (2000), "Công" shape 
   layout, múi hài tile roof, wooden structural supports, exhibition space inside
5. Hồ Văn (Literature Lake) - Large lake opposite Van Mieu entrance, Kim Chau islet 
   in center with Phuong Dinh pavilion, surrounded by trees

Analyze the provided image and return ONLY a valid JSON object:
{
  "identified": true/false,
  "landmark_id": "khue_van_cac|bia_tien_si|dai_thanh_mon|nha_thai_hoc|ho_van|unknown",
  "name_vi": "Tên tiếng Việt",
  "name_en": "English name",
  "confidence": 0-100,
  "reasoning": "Brief explanation of visual features that led to identification"
}

If the image does not clearly match any of the 5 landmarks, set identified=false 
and confidence to the actual low score.
```

### Bước 3: Chạy batch test tự động (Tuần 4)

Dùng script Python để test toàn bộ ảnh:

```python
# test_recognition.py
import google.generativeai as genai
import json
import os
from pathlib import Path

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

SYSTEM_PROMPT = """..."""  # Prompt ở trên

TEST_DIR = "van_mieu_dataset/test"
results = []

for landmark_dir in Path(TEST_DIR).iterdir():
    if not landmark_dir.is_dir():
        continue
    expected_label = landmark_dir.name  # e.g., "khue_van_cac"
    
    for img_path in landmark_dir.glob("*.jpg"):
        img = genai.upload_file(str(img_path))
        response = model.generate_content([SYSTEM_PROMPT, img])
        
        try:
            result = json.loads(response.text)
            correct = result.get("landmark_id") == expected_label
            results.append({
                "image": str(img_path),
                "expected": expected_label,
                "predicted": result.get("landmark_id"),
                "confidence": result.get("confidence"),
                "correct": correct
            })
        except json.JSONDecodeError:
            results.append({
                "image": str(img_path),
                "expected": expected_label,
                "predicted": "PARSE_ERROR",
                "correct": False
            })

# Tính accuracy
total = len(results)
correct = sum(1 for r in results if r["correct"])
accuracy = correct / total * 100

print(f"\n{'='*50}")
print(f"RECOGNITION ACCURACY REPORT")
print(f"{'='*50}")
print(f"Total images tested: {total}")
print(f"Correct: {correct}")
print(f"Accuracy: {accuracy:.1f}%")
print(f"Target: ≥ 85%")
print(f"Status: {'✅ PASS' if accuracy >= 85 else '❌ FAIL'}")

# Per-landmark breakdown
print(f"\nPer-landmark breakdown:")
for landmark in ["khue_van_cac", "bia_tien_si", "dai_thanh_mon", 
                  "nha_thai_hoc", "ho_van", "negative"]:
    landmark_results = [r for r in results if r["expected"] == landmark]
    if landmark_results:
        lm_correct = sum(1 for r in landmark_results if r["correct"])
        lm_total = len(landmark_results)
        print(f"  {landmark}: {lm_correct}/{lm_total} ({lm_correct/lm_total*100:.0f}%)")

# Save detailed results
with open("accuracy_report.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
```

---

## 📊 Bảng Tracking Kết Quả Test

Tạo spreadsheet tracking như sau:

| Image | Expected | Predicted | Confidence | Correct? | Lighting | Angle | Notes |
|-------|----------|-----------|:---:|:---:|---------|-------|-------|
| test_01.jpg | khue_van_cac | khue_van_cac | 95 | ✅ | Morning | Front | Clear shot |
| test_02.jpg | khue_van_cac | dai_thanh_mon | 45 | ❌ | Backlit | Side | Confused roof style |
| test_03.jpg | negative | unknown | 20 | ✅ | — | — | Parking lot |

---

## 📅 Timeline Thu Thập Ảnh

```
Tuần 2 (Ngày 1-2): Đi thực địa Văn Miếu
├── Buổi sáng (8-11h): Chụp reference + test trong điều kiện nắng đẹp
├── Buổi trưa (11-13h): Chụp test bóng đổ, nắng gắt
├── Buổi chiều (15-17h): Chụp test ngược sáng, ánh chiều
└── Chụp negative: xe, cây, bảng hiệu, du khách...

Tuần 2 (Ngày 3): Sắp xếp & metadata
├── Sort ảnh vào thư mục đúng cấu trúc
├── Đặt tên file theo convention
├── Điền metadata.json
└── Resize ảnh > 5MB xuống ≤ 5MB

Tuần 3 (Ngày 1): Test thủ công trên AI Studio
├── Test 5-10 ảnh/landmark trên AI Studio
├── Tinh chỉnh prompt nếu accuracy thấp
└── Xác nhận approach hoạt động

Tuần 4: Batch test tự động
├── Chạy script test_recognition.py
├── Phân tích accuracy report
└── Nếu < 85% → thêm few-shot examples hoặc refine prompt
```

---

## 💡 Tips Tăng Accuracy Không Cần Thêm Ảnh

Nếu test accuracy < 85%, thử các cách sau **trước khi chụp thêm ảnh**:

| Kỹ thuật | Mô tả | Effort |
|----------|-------|--------|
| **Refine prompt** | Thêm mô tả chi tiết đặc điểm phân biệt vào system prompt | 30 phút |
| **Few-shot examples** | Gửi 1-2 reference images kèm prompt | 1 giờ |
| **Negative examples** | Thêm ví dụ "đây KHÔNG phải là..." | 1 giờ |
| **Two-step reasoning** | Bước 1: liệt kê visual features. Bước 2: match với landmark | 2 giờ |
| **Confidence calibration** | Điều chỉnh ngưỡng confidence dựa trên data thực tế | 1 giờ |

> [!TIP]
> **Mẹo quan trọng nhất**: Chụp bằng **chính loại điện thoại** mà du khách sẽ dùng (iPhone, Samsung phổ thông). Đừng chụp bằng máy ảnh chuyên nghiệp – accuracy trên ảnh DSLR sẽ khác với ảnh phone camera.
