# API Reference

Base URL local: `http://localhost:8000`.

## Public Endpoints

### `GET /health`

```json
{"status": "ok"}
```

### `GET /api/groups`

Trả danh sách group và số item.

### `GET /api/groups/{group_id}/items`

- `200`: group và danh sách item.
- `404`: group không tồn tại.

### `GET /api/objects/all`

Trả toàn bộ item.

### `GET /api/objects/ungrouped`

Trả item chưa thuộc group.

### `GET /api/objects/{item_id}`

- `200`: chi tiết item và ảnh.
- `404`: item không tồn tại.

### `POST /api/search`

`multipart/form-data`:

- `search_image`: file ảnh.

Trả top kết quả và `found` dựa trên similarity threshold.

### `POST /api/generate`

```json
{
  "item_id": 1,
  "persona": "Mặc định",
  "language": "Tiếng Việt"
}
```

- `200`: `{item_id, content, persona, language}`.
- `404`: item không tồn tại.
- `502`: Gemini không thể sinh nội dung.

### `POST /api/chat`

```json
{
  "item_id": 1,
  "message": "Hiện vật này có gì đặc biệt?",
  "history": [],
  "persona": "Mặc định",
  "language": "Tiếng Việt"
}
```

- Role lịch sử chỉ nhận `user` hoặc `assistant`.
- Message dài tối đa 2.000 ký tự.
- `502` khi provider lỗi.

### `POST /api/tts`

```json
{
  "text": "Nội dung cần đọc",
  "language": "vi"
}
```

Trả `audio/mpeg`. Ngôn ngữ hỗ trợ: `vi`, `en`.

## Admin Mutation Endpoints

Khi `ADMIN_AUTH_ENABLED=true`, gửi:

```http
Authorization: Basic <base64(username:password)>
```

### `POST /api/groups`

```json
{"name": "Nhóm hiện vật"}
```

### `POST /api/objects/register`

`multipart/form-data`:

- `name`
- `description`
- `main_image`
- `side_image` tùy chọn
- `back_image` tùy chọn
- `group_id` hoặc `new_group_name` tùy chọn

### `PUT /api/objects/{item_id}`

```json
{
  "name": "Tên mới",
  "description": "Mô tả mới",
  "group_id": 1,
  "remove_from_group": false
}
```

### `DELETE /api/objects/{item_id}`

Xóa metadata, uploads, image embeddings và RAG document khi khả dụng.

### `PUT /api/objects/{item_id}/images/{angle}`

Angle: `front`, `side`, `back`.

### `DELETE /api/objects/{item_id}/images/{angle}`

Không cho xóa ảnh `front`; phải thay bằng ảnh khác.

## Mã Lỗi Chung

- `400`: dữ liệu nghiệp vụ không hợp lệ.
- `401`: thiếu hoặc sai admin credential.
- `404`: resource không tồn tại.
- `422`: request không khớp schema.
- `502`: AI/TTS provider lỗi.
- `503`: admin auth được bật nhưng server chưa cấu hình credential.
