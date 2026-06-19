## 2026-06-17 - Khám phá nhóm triển lãm cho Khách tham quan

Bối cảnh:
- Trang đích của khách tham quan có thể hiển thị "Không tải được danh sách khu di tích" hoặc chỉ hiển thị các nhóm public vì nó phụ thuộc vào API `/api/groups/public`.
- Mục tiêu là hiển thị tất cả các di tích hiện có cho khách tham quan ngay bây giờ, sau đó thu hẹp danh sách bằng GPS.

Các thay đổi:
- Đã thêm `GET /api/groups/discover` để trả về tất cả các nhóm được sắp xếp theo tên, đồng thời giữ nguyên `/api/groups/public` chỉ dành cho nhóm public.
- Cập nhật trang đích của khách tham quan và bảo vệ định tuyến (route guard) để sử dụng `listDiscoverableGroups()`.
- Cho phép hiển thị danh sách hiện vật cho các nhóm có thể khám phá (discoverable) để khi chọn một nhóm không public, khách không bị đẩy ra hoặc gặp lỗi 404.
- Đã thêm các bài test hồi quy (regression tests) cho backend/frontend đối với luồng khám phá mới.

## 2026-06-17 - Tối ưu tính liên quan của RAG và sửa lỗi âm thanh cho khách tham quan

Bối cảnh:
- Sau khi DINOv2 nhận diện được vật thể, trang chi tiết hiện vật vẫn có thể hiển thị "Tôi không tìm thấy thông tin trong tài liệu."
- Qua điều tra cho thấy tính năng tìm kiếm vật thể hoạt động tốt, nhưng bộ lọc ngữ cảnh RAG quá khắt khe: các đoạn văn bản (chunks) phải chứa tên đầy đủ hoặc mô tả đầy đủ của hiện vật.
- Nội dung mới được LLM tạo ra cũng có thể xuất hiện mà không có giọng đọc vì frontend đã loại bỏ `audio_url` khi `has_audio=false`, mặc dù endpoint âm thanh ở backend có thể tạo TTS (Text-to-Speech) theo yêu cầu.

Các thay đổi:
- Nới lỏng điều kiện khớp tài liệu-hiện vật RAG trong `backend/app/modules/rag/service.py`:
  - Thêm tính năng khớp từ khóa chính (primary keyword) cho các tên hiện vật như `trống`, `chuông` và `đại thành`.
  - Bỏ qua các từ quá chung chung như `văn`, `miếu`, `môn`, `quốc`, `tử` và `giám`.
  - Khi mô tả hiện vật có nội dung thực chất, tự động đưa các đoạn văn bản từ nhóm tài liệu đã truy xuất vào ngữ cảnh đã được xác minh (verified context) để LLM có thể sử dụng kết quả RAG tốt nhất thay vì chỉ dùng mô tả hiện vật.
- Đã thêm bao phủ test hồi quy trong `backend/tests/unit/test_rag_service.py` đối với:
  - Khớp từ khóa chính khi tên đầy đủ của hiện vật không có trong đoạn văn bản.
  - Giữ lại các tài liệu nhóm đã truy xuất đối với các hiện vật có mô tả phong phú.
- Xóa bộ nhớ đệm (cache) nội dung cũ cho nhóm `Quốc Tử Giám` khỏi `item_content_variants` để các hiện vật bị ảnh hưởng sẽ tự động tạo lại nội dung với logic RAG mới.
  - File backup đã tạo tại `backend/data/backups/cache-clear-20260617/app.db.before-content-cache-clear`.
  - Đã xóa dữ liệu cache của `Đền Khải Thánh`, `Đại Thành Môn`, `Đại Trung Môn` và `Trống Văn Miếu`.
  - Xác nhận không có vector DINOv2, hình ảnh đã upload, tài liệu RAG, RAG Chroma, BM25 hoặc chunk index nào bị xóa.
- Sửa lỗi xử lý âm thanh phía người dùng:
  - `frontend/app/[groupSlug]/item/[id]/page.tsx` hiện tại giữ nguyên `audio_url` ngay cả khi `has_audio=false`, cho phép endpoint âm thanh tự động tạo TTS theo yêu cầu.
  - `frontend/components/visitor/HeraGuidePanel.tsx` nay đã phân biệt rõ trạng thái âm thanh: “Đang chuẩn bị âm thanh” và “Đang phát âm thanh”.
  - Đã thêm các chuỗi i18n Anh/Việt vào `frontend/lib/i18n.ts`.
  - `backend/app/modules/content/tts.py` nay xử lý kết quả TTS rỗng như một lỗi.
  - `backend/app/modules/content/service.py` không còn lưu bytes âm thanh rỗng dưới dạng audio hợp lệ.
- Đã thêm `frontend/tests/item-audio-url.test.cjs` để ngăn chặn việc trang chi tiết hiện vật vô tình xóa URL âm thanh theo yêu cầu thêm lần nào nữa.
- Đã thêm bao phủ test hồi quy ở backend trong `backend/tests/api/test_content.py` cho các trường hợp kết quả TTS rỗng.

Xác nhận (Verification):
- Độ liên quan RAG / Content:
  - Chạy: `.\.venv\Scripts\python.exe -m pytest tests\unit\test_rag_service.py tests\unit\test_content_relevance.py`
  - Kết quả: `15 passed`.
- Kiểm tra riêng tính năng TTS / Content:
  - Chạy: `.\.venv\Scripts\python.exe -m pytest tests\api\test_content.py -k "empty_tts_result or audio_generates_when_missing or audio_streams_blob or get_item_content_generates_when_missing"`
  - Kết quả: `4 passed`.
  - Chạy: `.\.venv\Scripts\python.exe -m pytest tests\api\test_tts.py tests\unit\test_content_tts.py tests\unit\test_audio_jobs.py`
  - Kết quả: `11 passed`.
- Kiểm tra Frontend:
  - Chạy tất cả `frontend/tests/*.cjs`.
  - Chạy `npm.cmd run build`; build thành công.
  - Các cảnh báo build còn lại là các cảnh báo tối ưu hóa thẻ `<img>` đã có từ trước của Next.js.

Ghi chú:
- Chạy toàn bộ `tests/api/test_content.py` hiện tại có lỗi xác thực admin cho các endpoint edit/draft do `admin_auth_enabled=True` và các tests đó không gửi thông tin đăng nhập.
- Khách tham quan thực tế mở các hiện vật bị ảnh hưởng sẽ kích hoạt tự động tạo lại văn bản/âm thanh thông qua luồng mới cập nhật.

Các cải tiến cần làm tiếp theo (Follow-up candidates):
- Thêm trường trạng thái âm thanh rõ ràng vào Content API để UI không phải tự suy diễn trạng thái "đang chờ" từ việc kết hợp `has_audio=false` và `audio_url`.
- Cân nhắc thêm thông báo (toast) nhỏ hoặc lỗi nội tuyến vào UI khi máy chủ tạo âm thanh thất bại và trình duyệt không có sẵn tính năng đọc (speech).
- Xem xét lại cấu trúc băm (hashing) bộ đệm nội dung để thêm `group.knowledge_version`, nhờ đó các thay đổi trong tài liệu RAG sẽ tự nhiên làm vô hiệu hóa các nội dung đã tạo (variants) ngay cả khi việc vô hiệu hóa thủ công bị bỏ sót ở một số hiện vật.

## 2026-06-16 - Dọn dẹp luồng xử lý Frontend và làm sạch Workspace

Bối cảnh:
- Môi trường IDE (Antigravity IDE) bị treo (crash) với thông báo hết bộ nhớ (Out of Memory - OOM) khi đang chạy frontend.
- Qua kiểm tra, tiến trình build frontend hoạt động bình thường, nhưng workspace đang chứa quá nhiều thư mục sinh ra/raw (nặng) và có logic tìm kiếm bị lặp lặp ở nhiều nơi.

Các thay đổi:
- Đã gỡ bỏ các thư mục tự sinh/cache ra khỏi workspace trước đó:
  - `frontend/.next`
  - `frontend/.test-dist`
  - `.npm-cache-playwright`
  - `.playwright-cli`
  - `.pytest_cache`
  - `backend/.pytest_cache`
  - `backend/.pytest_tmp_review`
- Đã gỡ bỏ các tệp test artifacts bị theo dõi không nên nằm trong source code:
  - `backend/.pytest_tmp_review/test_upsert_item_document_repl0/bm25.pkl`
  - `backend/.pytest_tmp_review/test_upsert_item_document_repl0/chunks.pkl`
- Đã cập nhật `.gitignore` để tránh đẩy các thư mục nặng/tự sinh lên Git:
  - `backend/.pytest_tmp_review/`
  - `.uv-cache-codex/`
  - `frontend/.test-dist/`
  - `.npm-cache-playwright/`
  - `.playwright-cli/`
  - `raw/`
- Đã thêm `frontend/lib/api/search.ts` dưới dạng mô-đun API tập trung chuyên xử lý `POST /api/search`.
- Đã thêm `frontend/lib/useObjectSearch.ts` để tập trung hóa quá trình nén ảnh, theo dõi bối cảnh người dùng, và các lệnh gọi tìm kiếm vật thể.
- Đã cập nhật luồng tìm kiếm của khách tham quan chuyển sang sử dụng `useObjectSearch()`:
  - `frontend/app/[groupSlug]/method/page.tsx`
  - `frontend/app/[groupSlug]/scan/page.tsx`
  - `frontend/app/[groupSlug]/tour/[id]/play/page.tsx`
- Đã sửa các cảnh báo liên quan đến dependency của React Hook ở tệp `frontend/components/ItemsManagementPanel.tsx` bằng cách làm ổn định các hàm helpers chỉnh sửa/làm mới (reset/edit) câu chuyện bằng `useCallback`.

Xác nhận (Verification):
- Đã chạy lệnh `npm.cmd run build` trong `frontend`.
- Lần chạy đầu bị lỗi do mạng hộp cát (sandboxed network) chặn tải Google Fonts.
- Đã chạy lại với quyền truy cập mạng đầy đủ; quá trình build Next.js thành công.
- Đã dọn dẹp kết quả build mới `frontend/.next` sau khi xác nhận để workspace tiếp tục gọn nhẹ.
- Các cảnh báo còn lại là do bộ tối ưu hóa thẻ `<img>` của Next.js đã có từ trước.

Các cải tiến cần làm tiếp theo (Follow-up candidates):
- Tiếp tục phân tách tệp `frontend/lib/api.ts` thành các mô-đun chuyên biệt nhưng vẫn phải đảm bảo tính ổn định của các hàm xuất (exports) hiện hành.
- Thay thế việc sử dụng `localStorage` của Admin kết hợp các event trên đối tượng window thành việc sử dụng `AdminContext` hoặc một store state nhỏ gọn.
- Chuyển đổi cẩn thận các module render hình ảnh chịu tải lớn sang dùng thẻ `<Image>` của `next/image`, với sự xem xét trên các trình duyệt cho cả giao diện khách và admin.
- Loại trừ các thư mục `raw/`, `.worktrees/`, `.venv`, `backend/.venv`, `backend/data`, và `backend/uploads` khỏi công cụ index tệp tin/theo dõi (file watching) của IDE để giảm thiểu rủi ro bị lỗi hết bộ nhớ (OOM).

## 2026-06-16 - Tiêu chuẩn hóa file môi trường .env (Root env)

Bối cảnh:
- Cấu hình môi trường nội bộ bị chia tách giữa file `.env` ở thư mục gốc (root) dự án và file `backend/.env`.
- Đường dẫn môi trường chạy của backend như `./data/app.db` trước đó thường yêu cầu phải chạy lệnh trong thư mục `backend/`.

Các thay đổi:
- Đã gộp các giá trị cấu hình thực tế ở `backend/.env` vào file `.env` ở gốc (root).
- Đã gỡ bỏ file `backend/.env`.
- Đã cập nhật file `backend/app/core/config.py` để ưu tiên load từ `.env` gốc, xem file `backend/.env` chỉ là phương án dự phòng (fallback) để tương thích ngược.
- Đã chuẩn hóa lại các đường dẫn chạy runtime của backend sao cho các đường dẫn tương đối sẽ được phân giải tại thư mục `backend/` ngay cả khi người dùng chạy các lệnh (commands) từ thư mục gốc của dự án.
- Cập nhật `.env.example` tại thư mục gốc để làm file mẫu chuẩn về cấu hình backend, proxy frontend, các API key của AI, RAG, Auth, cache và logging.
- Thay thế `backend/.env.example` bằng một ghi chú ngắn gọn để điều hướng nhà phát triển đọc file `../.env.example`.
- Cập nhật các tệp hướng dẫn chạy nội bộ và `scripts/start-ngrok.ps1` để dùng file `.env` gốc.
- Cập nhật các tệp ghi chú triển khai Docker để loại bỏ sự phụ thuộc vào `backend/.env`.

Xác nhận (Verification):
- Đã kiểm tra thấy file `.env` ở gốc xuất hiện và `backend/.env` không còn tồn tại.
- Quá trình import `app.core.config` (khi đứng ở `backend/` và khi đứng ở dự án gốc) đều phân giải đúng các đường dẫn đến SQLite, Chroma, uploads và RAG BM25 nằm trong `backend/data`.
- Đã thử chạy `pytest` dành cho module config/auth. Lỗi không chạy được là do sự không đồng nhất giữa các môi trường ảo (Python virtualenv):
  - System Python thiếu thư viện `edge_tts`.
  - `backend/.venv` thiếu thư viện `pytest`.
  - Root `.venv` đang trỏ đến một Python executable không tồn tại.

Các cải tiến cần làm tiếp theo (Follow-up candidates):
- Tạo lại hoặc sửa lỗi môi trường ảo của backend, sau đó chạy lại các unit test về config/auth.
- Xem xét xóa hẳn `backend/.env.example` sau khi toàn bộ docs và ghi chú (onboarding notes) đều đã điều hướng hoàn toàn về file `.env.example` gốc.
## 2026-06-19 - Loại bỏ gọi TTS trùng và giới hạn lịch sử chat gửi lên LLM

Bối cảnh:
- Sau khi nhận diện ảnh và sinh nội dung LLM, API content vừa lên lịch sinh TTS
  nền, vừa trả về `audio_url`.
- Frontend dùng ngay `audio_url`; endpoint audio cũng tự sinh TTS nếu audio chưa
  tồn tại. Hai đường này có thể cùng gọi Edge TTS cho một nội dung.
- Frontend gửi toàn bộ lịch sử chat lên backend, trong khi backend chỉ chấp nhận
  tối đa 20 message và generator chỉ sử dụng 10 message gần nhất.

Các thay đổi:
- Bỏ việc lên lịch background TTS trong `GET /api/objects/{item_id}/content`.
- API content vẫn trả `audio_url` khi chưa có audio; TTS chỉ được sinh khi
  endpoint audio thực sự được yêu cầu.
- Giữ nguyên cơ chế lưu audio vào biến thể nội dung để những lần phát sau dùng
  lại audio đã tạo.
- Frontend chỉ gửi `chatHistory.slice(-10)` khi gọi API chat.
- Lịch sử hiển thị trên giao diện vẫn được giữ đầy đủ trong phiên hiện tại.

Xác nhận:
- Test flow TTS:
  - `test_get_item_content_defers_tts_until_audio_endpoint_is_requested`
  - `test_get_item_content_audio_generates_when_missing`
  - `test_get_item_content_audio_streams_blob`
  - Kết quả: `3 passed`.
- Test hợp đồng frontend về giới hạn lịch sử chat:
  - Chạy `node frontend/tests/visitor-persona-flow.test.cjs`.
  - Kết quả: thành công.
- Test API chat đại diện:
  - `test_chat_uses_item_description_when_rag_is_unavailable`
  - `test_chat_uses_user_message_as_rag_query`
  - Kết quả: `2 passed`.

## 2026-06-19 - Sửa lỗi giao diện nhảy trên mobile bằng Wrapper toàn cục (Global Wrapper)

Bối cảnh:
- Khi mở trên điện thoại, giao diện bị xê dịch (layout shift) và mất một phần hiển thị (ví dụ: mất chữ ở phần persona) do cách trình duyệt mobile xử lý thanh địa chỉ và chiều cao `100vh`.
- Từng trang sử dụng các lớp CSS `.artifact-shell` và `min-h-screen` lặp lại, không có sự nhất quán và gây ra lỗi nhảy trang khi chuyển đổi.

Các thay đổi (Phương án 1):
- Cập nhật `globals.css`:
  - Thay `min-h-[100vh]` thành `min-h-[100dvh]` cho `.artifact-shell` để thích ứng chính xác với chiều cao thực tế của trình duyệt di động (kể cả khi hiện/ẩn thanh địa chỉ).
  - Thêm `scrollbar-gutter: stable` vào body để tránh xê dịch giao diện khi thanh cuộn xuất hiện.
- Thêm Wrapper toàn cục (Global Wrapper) trong `app/[groupSlug]/layout.tsx` sử dụng `.artifact-shell` để bọc mọi trang bên trong nhóm, đảm bảo background và cấu trúc được duy trì nhất quán.
- Dọn dẹp lại cấu trúc các trang (Refactoring):
  - Xóa bỏ việc bọc thủ công bằng lớp `artifact-shell` và `min-h-screen` tại các trang con: `scan/page.tsx`, `method/page.tsx`, `manual/page.tsx`, `tour/page.tsx`, `tour/[id]/page.tsx`, `tour/[id]/play/page.tsx`, `tour/[id]/complete/page.tsx`, `tour-match/page.tsx`, `tour-match/room/[roomId]/page.tsx`, `tour-match/room/[roomId]/play/page.tsx`, `item/[id]/page.tsx`.
  - Thay thế chúng bằng thẻ `<main className="flex flex-1 flex-col w-full">` (hoặc tương tự) để tận dụng cấu trúc Flexbox toàn cục.
  - Sửa lỗi chiều cao màn hình tải và lỗi (`min-h-screen` thành `min-h-[100dvh]`) ở các màn hình `loading` hoặc `not found` bên trong các trang.

Xác nhận:
- Giao diện đã cố định chuẩn hơn trên mobile, không còn hiện tượng xê dịch khi chuyển trang hoặc hiển thị camera/persona.
- Đồng nhất logic layout, giảm sự trùng lặp code trong các page.
