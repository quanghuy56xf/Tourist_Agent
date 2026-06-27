## 2026-06-28 - Tối ưu Streaming TTS cho Companion

Bối cảnh:
- Luồng Companion streaming đã chạy theo mô hình Producer-Consumer + SSE nhưng khách vẫn cảm thấy chờ lâu trước câu nói đầu tiên và giữa các đoạn audio.

Các thay đổi:
- Thêm cached acknowledgement audio cho Companion để phản hồi bằng giọng nói gần như ngay khi khách gửi tin nhắn.
- Thêm early phrase chunking để gửi đoạn đầu sang TTS trước khi LLM kết thúc cả câu dài.
- Chuyển TTS Companion sang 2 workers synthesize song song, giữ đúng thứ tự phát bằng `seq` và `audio_orderer`.
- Frontend giữ trạng thái speaking thêm một khoảng ngắn giữa các đoạn để giảm cảm giác audio bị khựng.
- Phạm vi chỉ áp dụng cho `/api/companion/chat/stream`, không thay đổi luồng TTS trang thông tin hiện vật.

Xác nhận:
- `uv --project backend run pytest backend/tests/unit/test_companion_streaming_tts.py backend/tests/api/test_companion.py`: 12 passed.
- `npm.cmd --prefix frontend run build`: thành công, chỉ còn cảnh báo `<img>` đã có từ trước.
- `git diff --check`: không có lỗi whitespace.

## 2026-06-27 - Cải thiện bảo mật Prompt Injection và chuẩn bị tính năng Góc nhìn lịch sử

Bối cảnh:
- Cần gia cố bảo vệ hệ thống tránh rò rỉ API Key và ngăn ngừa kẻ tấn công sử dụng các chiêu trò jailbreak (như hóa thân thành hacker hoặc yêu cầu xuất code Python).
- Chuẩn bị phát triển tính năng Góc nhìn Lịch sử (Before/After) nhằm nâng cao trải nghiệm thị giác cho khách tham quan.

Các thay đổi:
- Đã triển khai "Shield Clause" (Luật bảo vệ) mạnh mẽ vào `base_instructions` và `system_prompt` trong `generator.py` cho cả hai luồng Hướng dẫn viên (Artifact) và Trợ lý ảo (Companion).
- Chạy các script benchmark kiểm thử (`test_prompt_injection.py`) và ghi nhận tỉ lệ phòng thủ thành công 100% trước các Prompt Injection phổ biến mà không làm ảnh hưởng đến khả năng kể chuyện của Persona.
- Lên 3 phương án ý tưởng thiết kế tính năng Góc nhìn lịch sử: Trượt ngang (Slider), Kính lúp xuyên thấu (X-Ray Lens), và Cuộn theo dòng thời gian (Time-lapse Scroll) để người dùng lựa chọn.
- Phân tích và báo cáo nhanh về cơ chế Tour Khám phá (Guided Tour) và Game Quét ảnh (Tour Match) đang có trong hệ thống.

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

## 2026-06-21 - Triển khai AI Historical Companion

Bối cảnh:
- Bổ sung một hành trình tham quan riêng với nhân vật Lê Quý Đôn ở tuổi 18.
- Nhân vật cần kể chuyện theo ngữ cảnh hiện vật, ghi nhớ các điểm khách đã ghé và gợi ý điểm tiếp theo.

Các thay đổi:
- Thêm hành trình `/{groupSlug}/companion` và lưu Companion mode trong `sessionStorage`.
- Thêm giao diện avatar, intro video, chat và giọng đọc riêng cho Companion.
- Tích hợp Companion vào trang chi tiết hiện vật; lưu các hiện vật đã ghé trong trình duyệt.
- Thêm `POST /api/companion/chat`; backend xác minh hiện vật, giới hạn lịch sử chat và chỉ sử dụng dữ liệu RAG thuộc Group hiện tại.
- Thêm giọng Edge TTS `vi-VN-NamMinhNeural` cho nhân vật.
- Companion có thể chủ động gợi ý điểm chưa ghé tiếp theo và gửi gợi ý sang Minimap.
- Bổ sung fallback khi chưa quét hiện vật và hỗ trợ nhập câu hỏi bằng văn bản.

## 2026-06-21 - Thay Web Speech API bằng MediaRecorder và Gemini STT

Bối cảnh:
- `webkitSpeechRecognition` thường trả lỗi `aborted` trên Safari iPhone khi nhận dạng tiếng Việt.
- Quyền microphone, HTTPS và Cloudflare Tunnel vẫn hoạt động; vấn đề nằm ở khả năng nhận dạng tiếng Việt của Web Speech API/iOS.

Các thay đổi:
- Loại bỏ hoàn toàn `SpeechRecognition` và `webkitSpeechRecognition` khỏi Voice Input.
- Frontend dùng `getUserMedia` và `MediaRecorder` để ghi âm; ưu tiên `audio/mp4` trên Safari và dùng WebM/Ogg khi được hỗ trợ.
- Nút microphone chuyển qua hai trạng thái: `Đang ghi âm...` và `Đang xử lý...`.
- Thêm `transcribeAudio()` gửi Blob bằng `multipart/form-data` đến `POST /api/stt`.
- Thêm module backend `app/modules/stt/` dùng `gemini-2.5-flash-lite` để chép audio thành tiếng Việt.
- API kiểm tra MIME type, file rỗng và giới hạn dung lượng 5 MB.
- Transcript được đưa trở lại luồng Companion chat hiện có; không thay đổi logic RAG hoặc sinh câu trả lời.

Xác nhận:
- Backend STT và Companion: `9 passed`.
- Frontend Companion và MediaRecorder contract tests: thành công.
- `npm.cmd run build`: build production thành công.
- `git diff --check`: không có lỗi whitespace.
- Cần kiểm thử thủ công microphone trên Safari iPhone qua Cloudflare Tunnel.

## 2026-06-21 - Chuyển Minimap sang cấu hình động theo Group

Bối cảnh:
- Minimap trước đây dựa trên cấu hình tĩnh trong frontend, khó tái sử dụng giữa nhiều Group và nhiều môi trường có Item ID khác nhau.

Các thay đổi:
- Lưu cấu hình riêng cho từng Group trong `groups.minimap_config`.
- Cho phép Admin tải xuống, chỉnh sửa và tải lên JSON dùng `itemNames` ổn định.
- Visitor API chuyển `itemNames` thành `itemIds` thuộc đúng Group tại runtime.
- Visitor UI tải trước cấu hình trước khi mở modal và giữ các trạng thái marker, hiện vật gần nhất và fallback.
- Thay `frontend/lib/minimapConfig.ts` bằng cấu hình từ API kết hợp `frontend/lib/minimapState.ts`.

## 2026-06-22 - Hoàn thiện hành trình Companion chủ động

Bối cảnh:
- Companion cần dẫn dắt khách tham quan chủ động hơn thay vì chờ khách tự tìm camera, quét hiện vật và mở bản đồ.

Các thay đổi:
- Tự động chào hỏi khi mở hành trình và yêu cầu khách quét hiện vật.
- Nhúng camera toàn màn hình vào giao diện chat; có thể tự mở khi câu thoại yêu cầu chụp ảnh hoặc hướng camera.
- Tách câu trả lời theo ngắt đoạn thành các bong bóng chat riêng để làm rõ lời hướng dẫn.
- Giữ một lần gọi TTS cho toàn bộ câu trả lời dù giao diện hiển thị nhiều bong bóng.
- Khi Companion gợi ý điểm tiếp theo, Minimap tự mở sau khoảng hai giây và làm nổi bật vị trí được đề xuất.

## 2026-06-23 - Chọn avatar 2D thay cho MVP 3D

Bối cảnh:
- Logic đọc `emotion` và kích hoạt animation cho avatar 3D `.glb` đã được thử nghiệm.
- Model web bị giới hạn dung lượng dẫn đến chất lượng low-poly, tăng nguy cơ uncanny valley và ảnh hưởng thời gian tải trên mobile.

Quyết định:
- Loại bỏ avatar 3D khỏi phạm vi MVP.
- Tiếp tục sử dụng hình ảnh 2D chất lượng cao cho Lê Quý Đôn.
- Định hướng tiếp theo là Dynamic Collapsible Avatar: hiển thị lớn ở phần mở đầu rồi thu gọn thành avatar tròn khi hội thoại dài, dành thêm không gian cho chat, camera và Minimap.

## 2026-06-23 - Triển khai Dynamic Collapsible Avatar với đường phân cách lõm (Concave Curve)

Bối cảnh:
- Sau khi loại bỏ Avatar 3D, Avatar 2D cần được nâng cấp để tạo ấn tượng sống động khi AI nói nhưng lại phải tiết kiệm không gian màn hình thiết bị di động khi AI ngừng nói để hiển thị khung Chat.
- Yêu cầu chuyển tiếp mượt mà từ diện tích ảnh Avatar xuống không gian Chat bằng đường cong tự nhiên và hiệu ứng fade.

Các thay đổi:
- Cập nhật `CompanionAvatar.tsx` thêm prop `collapsed`. Khi `isSpeaking=true`, Avatar lớn chiếm ~35-40% chiều cao màn hình. Khi `isSpeaking=false` và đã có chat history, Avatar thu nhỏ thành hình tròn ở góc trái, nhường chỗ cho khung Chat.
- Cập nhật `CompanionChat.tsx` tính toán state `avatarCollapsed`, điều hướng CSS cho Wrapper và tự động kích hoạt `scrollIntoView` mượt mà với độ trễ `300ms` ngay sau khi Avatar thu gọn.
- Thêm đường phân cách tạo từ SVG lõm (`Q200,50`) cùng Gradient mờ ảo trong suốt `40px` tạo hiệu ứng nối mạch tự nhiên giữa vùng Avatar và màn hình Chat. Cả hai layer này đều có animation mờ đi khi Avatar thu nhỏ.
- Cập nhật `globals.css` để thêm `transition: max-height 300ms ease-out` cho lớp `.companion-avatar-wrapper`.
- Tinh chỉnh đường cong ranh giới (clip-path) và mask-image để ảnh Avatar khớp hoàn hảo với khung Chat mà không bị lộ viền cắt.
- Nâng cấp tốc độ chuyển đổi CSS/React (max-height, scale) sang 500ms `ease-in-out` để tạo cảm giác mượt mà, đậm chất điện ảnh.
- Bổ sung khả năng toggle mở rộng/thu nhỏ Avatar thủ công thông qua click/touch, tiện lợi khi khách muốn nhìn rõ nhân vật.
- Cải thiện không gian Chat bằng cách thu nhỏ cụm nút Micro/Waveform xuống 2/3 và căn chỉnh lại các lề (margin/padding) để phần Chat được đẩy sâu xuống phía dưới.

## 2026-06-23 - Tối ưu hiệu năng âm thanh (Backend-Driven Pipeline Streaming)

Bối cảnh:
- Trước đây, Frontend phải đợi LLM stream chữ về, cắt thành bong bóng rồi mới gọi `fetch` HTTP (`POST /api/tts`) cho từng bong bóng. Việc này tạo ra nhiều request HTTP và tăng độ trễ (Time-To-First-Byte của audio bị chậm).

Các thay đổi:
- **Backend:** Nâng cấp Endpoint `POST /api/companion/chat/stream` để chạy song song LLM Streaming và TTS Synthesizing bằng `asyncio`. Ngay khi gom đủ một câu (dấu câu hoặc dòng mới), Backend tự động gọi Edge TTS và đẩy audio MP3 đã mã hóa Base64 qua SSE (`event: audio`).
- **Frontend:** Cập nhật `chatWithCompanionStream` để xử lý event `audio`. Thay vì gọi API rời rạc, Frontend hiện chỉ cần giải mã Base64 sang Blob, tạo ObjectURL, và đưa vào một Audio Queue nhỏ gọn nội bộ để phát nhạc nối tiếp.
- Giảm tổng số lượng kết nối mạng xuống còn đúng 1 request Server-Sent Events (SSE) duy nhất, kéo giảm độ trễ Time-to-First-Audio và loại bỏ hoàn toàn các HTTP Request thừa.

## 2026-06-24 - Nâng cấp UX/UI và hoàn thiện Companion Chat

Bối cảnh:
- Màn hình trò chuyện với Lê Quý Đôn (Companion Chat) cần được điều chỉnh giao diện (UI) và trải nghiệm (UX) để trực quan hơn, thân thiện với thiết bị di động hơn và tránh gây nhầm lẫn với các tính năng quét của hệ thống cũ.

Các thay đổi:
- **Tính năng A (Fixed Camera Button)**: Di chuyển nút mở Camera 📸 ra khỏi ô nhập liệu (text input) và thiết kế lại dưới dạng giao diện nổi (Floating UI) nằm ngay phía trên biểu tượng bàn phím.
- **Tính năng B (Suggested Questions)**: Tích hợp hệ thống câu hỏi gợi ý từ LLM (với định dạng `||Q: ...||`). Trích xuất câu hỏi và biến thành các nút bấm hành động (Action Buttons) để khách dễ dàng tương tác.
- **Tính năng C (Smart Idle Timer)**: Thêm đồng hồ đếm ngược thông minh (30 giây) để hiển thị nút mồi "📸 Quét tiếp" nếu người dùng không có tương tác nào sau khi Lê Quý Đôn nói xong, và chỉ hiển thị khi không có nút gợi ý nào khác.
- **Sửa lỗi Avatar Layout**:
  - Dịch chuyển avatar ở trạng thái thu gọn (collapsed) xuống dưới để không bị đè lên chữ tiêu đề.
  - Sửa lỗi hoạt ảnh phóng to/thu nhỏ (zoom effect) trên thiết bị di động bằng cách đổi `aspect-[4/3]` và `h-16 w-16` sang `aspect-square`, thêm `transform-gpu` để khắc phục lỗi phần cứng Safari.
  - Đẩy avatar xuống dưới và thêm hiệu ứng `radial-gradient` vào viền lõm để mượt mà hơn với hình nền chat.
- **Responsive Wrapper**: Giới hạn lại kích thước màn hình `page.tsx` của Companion bằng một vùng chứa `max-w-md` (tự động căn giữa nền đen trên máy tính/tablet) để giao diện không bị vỡ hoặc xê dịch thất thường.
- **Đồng bộ hóa luồng quét**: Ẩn nút "Quét" mặc định ở góc trên bên phải màn hình Lê Quý Đôn để giảm nhầm lẫn, tập trung toàn bộ người dùng vào trải nghiệm quét bằng nút nổi (Inline Scanner) trong luồng chat.

## 2026-06-24 - Tạm ngưng tính năng Tiếng Anh cho Companion
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

## 2026-06-21 - Triển khai AI Historical Companion

Bối cảnh:
- Bổ sung một hành trình tham quan riêng với nhân vật Lê Quý Đôn ở tuổi 18.
- Nhân vật cần kể chuyện theo ngữ cảnh hiện vật, ghi nhớ các điểm khách đã ghé và gợi ý điểm tiếp theo.

Các thay đổi:
- Thêm hành trình `/{groupSlug}/companion` và lưu Companion mode trong `sessionStorage`.
- Thêm giao diện avatar, intro video, chat và giọng đọc riêng cho Companion.
- Tích hợp Companion vào trang chi tiết hiện vật; lưu các hiện vật đã ghé trong trình duyệt.
- Thêm `POST /api/companion/chat`; backend xác minh hiện vật, giới hạn lịch sử chat và chỉ sử dụng dữ liệu RAG thuộc Group hiện tại.
- Thêm giọng Edge TTS `vi-VN-NamMinhNeural` cho nhân vật.
- Companion có thể chủ động gợi ý điểm chưa ghé tiếp theo và gửi gợi ý sang Minimap.
- Bổ sung fallback khi chưa quét hiện vật và hỗ trợ nhập câu hỏi bằng văn bản.

## 2026-06-21 - Thay Web Speech API bằng MediaRecorder và Gemini STT

Bối cảnh:
- `webkitSpeechRecognition` thường trả lỗi `aborted` trên Safari iPhone khi nhận dạng tiếng Việt.
- Quyền microphone, HTTPS và Cloudflare Tunnel vẫn hoạt động; vấn đề nằm ở khả năng nhận dạng tiếng Việt của Web Speech API/iOS.

Các thay đổi:
- Loại bỏ hoàn toàn `SpeechRecognition` và `webkitSpeechRecognition` khỏi Voice Input.
- Frontend dùng `getUserMedia` và `MediaRecorder` để ghi âm; ưu tiên `audio/mp4` trên Safari và dùng WebM/Ogg khi được hỗ trợ.
- Nút microphone chuyển qua hai trạng thái: `Đang ghi âm...` và `Đang xử lý...`.
- Thêm `transcribeAudio()` gửi Blob bằng `multipart/form-data` đến `POST /api/stt`.
- Thêm module backend `app/modules/stt/` dùng `gemini-2.5-flash-lite` để chép audio thành tiếng Việt.
- API kiểm tra MIME type, file rỗng và giới hạn dung lượng 5 MB.
- Transcript được đưa trở lại luồng Companion chat hiện có; không thay đổi logic RAG hoặc sinh câu trả lời.

Xác nhận:
- Backend STT và Companion: `9 passed`.
- Frontend Companion và MediaRecorder contract tests: thành công.
- `npm.cmd run build`: build production thành công.
- `git diff --check`: không có lỗi whitespace.
- Cần kiểm thử thủ công microphone trên Safari iPhone qua Cloudflare Tunnel.

## 2026-06-21 - Chuyển Minimap sang cấu hình động theo Group

Bối cảnh:
- Minimap trước đây dựa trên cấu hình tĩnh trong frontend, khó tái sử dụng giữa nhiều Group và nhiều môi trường có Item ID khác nhau.

Các thay đổi:
- Lưu cấu hình riêng cho từng Group trong `groups.minimap_config`.
- Cho phép Admin tải xuống, chỉnh sửa và tải lên JSON dùng `itemNames` ổn định.
- Visitor API chuyển `itemNames` thành `itemIds` thuộc đúng Group tại runtime.
- Visitor UI tải trước cấu hình trước khi mở modal và giữ các trạng thái marker, hiện vật gần nhất và fallback.
- Thay `frontend/lib/minimapConfig.ts` bằng cấu hình từ API kết hợp `frontend/lib/minimapState.ts`.

## 2026-06-22 - Hoàn thiện hành trình Companion chủ động

Bối cảnh:
- Companion cần dẫn dắt khách tham quan chủ động hơn thay vì chờ khách tự tìm camera, quét hiện vật và mở bản đồ.

Các thay đổi:
- Tự động chào hỏi khi mở hành trình và yêu cầu khách quét hiện vật.
- Nhúng camera toàn màn hình vào giao diện chat; có thể tự mở khi câu thoại yêu cầu chụp ảnh hoặc hướng camera.
- Tách câu trả lời theo ngắt đoạn thành các bong bóng chat riêng để làm rõ lời hướng dẫn.
- Giữ một lần gọi TTS cho toàn bộ câu trả lời dù giao diện hiển thị nhiều bong bóng.
- Khi Companion gợi ý điểm tiếp theo, Minimap tự mở sau khoảng hai giây và làm nổi bật vị trí được đề xuất.

## 2026-06-23 - Chọn avatar 2D thay cho MVP 3D

Bối cảnh:
- Logic đọc `emotion` và kích hoạt animation cho avatar 3D `.glb` đã được thử nghiệm.
- Model web bị giới hạn dung lượng dẫn đến chất lượng low-poly, tăng nguy cơ uncanny valley và ảnh hưởng thời gian tải trên mobile.

Quyết định:
- Loại bỏ avatar 3D khỏi phạm vi MVP.
- Tiếp tục sử dụng hình ảnh 2D chất lượng cao cho Lê Quý Đôn.
- Định hướng tiếp theo là Dynamic Collapsible Avatar: hiển thị lớn ở phần mở đầu rồi thu gọn thành avatar tròn khi hội thoại dài, dành thêm không gian cho chat, camera và Minimap.

## 2026-06-23 - Triển khai Dynamic Collapsible Avatar với đường phân cách lõm (Concave Curve)

Bối cảnh:
- Sau khi loại bỏ Avatar 3D, Avatar 2D cần được nâng cấp để tạo ấn tượng sống động khi AI nói nhưng lại phải tiết kiệm không gian màn hình thiết bị di động khi AI ngừng nói để hiển thị khung Chat.
- Yêu cầu chuyển tiếp mượt mà từ diện tích ảnh Avatar xuống không gian Chat bằng đường cong tự nhiên và hiệu ứng fade.

Các thay đổi:
- Cập nhật `CompanionAvatar.tsx` thêm prop `collapsed`. Khi `isSpeaking=true`, Avatar lớn chiếm ~35-40% chiều cao màn hình. Khi `isSpeaking=false` và đã có chat history, Avatar thu nhỏ thành hình tròn ở góc trái, nhường chỗ cho khung Chat.
- Cập nhật `CompanionChat.tsx` tính toán state `avatarCollapsed`, điều hướng CSS cho Wrapper và tự động kích hoạt `scrollIntoView` mượt mà với độ trễ `300ms` ngay sau khi Avatar thu gọn.
- Thêm đường phân cách tạo từ SVG lõm (`Q200,50`) cùng Gradient mờ ảo trong suốt `40px` tạo hiệu ứng nối mạch tự nhiên giữa vùng Avatar và màn hình Chat. Cả hai layer này đều có animation mờ đi khi Avatar thu nhỏ.
- Cập nhật `globals.css` để thêm `transition: max-height 300ms ease-out` cho lớp `.companion-avatar-wrapper`.
- Tinh chỉnh đường cong ranh giới (clip-path) và mask-image để ảnh Avatar khớp hoàn hảo với khung Chat mà không bị lộ viền cắt.
- Nâng cấp tốc độ chuyển đổi CSS/React (max-height, scale) sang 500ms `ease-in-out` để tạo cảm giác mượt mà, đậm chất điện ảnh.
- Bổ sung khả năng toggle mở rộng/thu nhỏ Avatar thủ công thông qua click/touch, tiện lợi khi khách muốn nhìn rõ nhân vật.
- Cải thiện không gian Chat bằng cách thu nhỏ cụm nút Micro/Waveform xuống 2/3 và căn chỉnh lại các lề (margin/padding) để phần Chat được đẩy sâu xuống phía dưới.

## 2026-06-23 - Tối ưu hiệu năng âm thanh (Backend-Driven Pipeline Streaming)

Bối cảnh:
- Trước đây, Frontend phải đợi LLM stream chữ về, cắt thành bong bóng rồi mới gọi `fetch` HTTP (`POST /api/tts`) cho từng bong bóng. Việc này tạo ra nhiều request HTTP và tăng độ trễ (Time-To-First-Byte của audio bị chậm).

Các thay đổi:
- **Backend:** Nâng cấp Endpoint `POST /api/companion/chat/stream` để chạy song song LLM Streaming và TTS Synthesizing bằng `asyncio`. Ngay khi gom đủ một câu (dấu câu hoặc dòng mới), Backend tự động gọi Edge TTS và đẩy audio MP3 đã mã hóa Base64 qua SSE (`event: audio`).
- **Frontend:** Cập nhật `chatWithCompanionStream` để xử lý event `audio`. Thay vì gọi API rời rạc, Frontend hiện chỉ cần giải mã Base64 sang Blob, tạo ObjectURL, và đưa vào một Audio Queue nhỏ gọn nội bộ để phát nhạc nối tiếp.
- Giảm tổng số lượng kết nối mạng xuống còn đúng 1 request Server-Sent Events (SSE) duy nhất, kéo giảm độ trễ Time-to-First-Audio và loại bỏ hoàn toàn các HTTP Request thừa.

## 2026-06-24 - Nâng cấp UX/UI và hoàn thiện Companion Chat

Bối cảnh:
- Màn hình trò chuyện với Lê Quý Đôn (Companion Chat) cần được điều chỉnh giao diện (UI) và trải nghiệm (UX) để trực quan hơn, thân thiện với thiết bị di động hơn và tránh gây nhầm lẫn với các tính năng quét của hệ thống cũ.

Các thay đổi:
- **Tính năng A (Fixed Camera Button)**: Di chuyển nút mở Camera 📸 ra khỏi ô nhập liệu (text input) và thiết kế lại dưới dạng giao diện nổi (Floating UI) nằm ngay phía trên biểu tượng bàn phím.
- **Tính năng B (Suggested Questions)**: Tích hợp hệ thống câu hỏi gợi ý từ LLM (với định dạng `||Q: ...||`). Trích xuất câu hỏi và biến thành các nút bấm hành động (Action Buttons) để khách dễ dàng tương tác.
- **Tính năng C (Smart Idle Timer)**: Thêm đồng hồ đếm ngược thông minh (30 giây) để hiển thị nút mồi "📸 Quét tiếp" nếu người dùng không có tương tác nào sau khi Lê Quý Đôn nói xong, và chỉ hiển thị khi không có nút gợi ý nào khác.
- **Sửa lỗi Avatar Layout**:
  - Dịch chuyển avatar ở trạng thái thu gọn (collapsed) xuống dưới để không bị đè lên chữ tiêu đề.
  - Sửa lỗi hoạt ảnh phóng to/thu nhỏ (zoom effect) trên thiết bị di động bằng cách đổi `aspect-[4/3]` và `h-16 w-16` sang `aspect-square`, thêm `transform-gpu` để khắc phục lỗi phần cứng Safari.
  - Đẩy avatar xuống dưới và thêm hiệu ứng `radial-gradient` vào viền lõm để mượt mà hơn với hình nền chat.
- **Responsive Wrapper**: Giới hạn lại kích thước màn hình `page.tsx` của Companion bằng một vùng chứa `max-w-md` (tự động căn giữa nền đen trên máy tính/tablet) để giao diện không bị vỡ hoặc xê dịch thất thường.
- **Đồng bộ hóa luồng quét**: Ẩn nút "Quét" mặc định ở góc trên bên phải màn hình Lê Quý Đôn để giảm nhầm lẫn, tập trung toàn bộ người dùng vào trải nghiệm quét bằng nút nổi (Inline Scanner) trong luồng chat.

## 2026-06-24 - Tạm ngưng tính năng Tiếng Anh cho Companion

Bối cảnh:
- Người dùng đã quyết định tạm ngưng việc hỗ trợ Tiếng Anh trên Companion để dành cho đợt nâng cấp sau. Nhánh `feature/companionv6` đã được commit chứa các cập nhật tiếng Anh chưa hoàn chỉnh và quay trở lại nhánh chính.

Trạng thái Companion:
- Một phiên bản Companion cơ bản đã hoàn thành với UX đơn giản.
- Companion hiện tại xử lý giao tiếp cốt lõi bằng tiếng Việt cùng avatar hiển thị collapsible linh hoạt. Sẽ tiếp tục cải thiện UX/UI trong tương lai.

## 2026-06-24 - Hoàn thiện Hỗ trợ Tiếng Anh (i18n) cho Companion và Sửa lỗi TTS

Bối cảnh:
- Sau khi tạm ngưng, dự án quyết định triển khai dứt điểm tính năng đa ngôn ngữ (Tiếng Anh/Tiếng Việt) cho luồng Companion.
- LLM tạo ra các câu hỏi gợi ý với định dạng `||Q: Câu hỏi||`, nhưng hệ thống TTS lại tự động đọc toàn bộ các ký tự định dạng này gây khó chịu.
- Nút "Mở camera" mặc định lúc ứng dụng vừa khởi động bị các nút câu hỏi gợi ý (Action Buttons) của LLM ghi đè mất.
- Các câu hỏi gợi ý do LLM sinh ra đôi khi hơi lan man và thiếu tập trung vào di tích.

Các thay đổi:
- **Đa ngôn ngữ (i18n)**: Thay thế toàn bộ text cứng tiếng Việt trong `CompanionChat`, `CompanionIntro`, `CompanionAvatar`, `MinimapModal`, `MinimapButton` bằng hệ thống từ điển thông qua hook `useVisitorLocale`. Cập nhật `i18n.ts` với đầy đủ keys.
- **Giọng đọc AI**: Cập nhật `personas.py` để sử dụng giọng `en-US-GuyNeural` khi khách chọn Tiếng Anh và `vi-VN-NamMinhNeural` cho Tiếng Việt. Sửa lỗi import thiếu module `VisitorLocaleProvider`.
- **Sửa lỗi đè nút (Button Overwrite)**: Cập nhật luồng nhận SSE Events trong `CompanionChat.tsx`. Thay vì ghi đè toàn bộ mảng `actionButtons`, hệ thống giờ đây chỉ lọc và thay thế các nút dạng text (câu hỏi gợi ý), giữ nguyên các nút hệ thống như `open_camera` hay `rate_experience`.
- **Sửa lỗi TTS đọc định dạng**: Can thiệp vào `chat_router.py` (luồng `tts_consumer`). Khi phát hiện ký tự `||Q:`, backend sẽ tự động cắt chuỗi và ngừng gửi nội dung còn lại tới engine Edge TTS, giúp âm thanh kết thúc mượt mà trước khi hiện câu hỏi gợi ý.
- **Tinh chỉnh LLM Prompt**: Bổ sung yêu cầu khắt khe vào `generator.py` để LLM ưu tiên sinh các câu hỏi gợi ý liên quan trực tiếp đến hiện vật, khu di tích hoặc các sự thật lịch sử độc đáo.

## 2026-06-27 - Cấu hình CI/CD toàn diện và Tinh chỉnh UI

Bối cảnh:
- Hệ thống cần được tự động hóa quy trình kiểm thử và triển khai (CI/CD) để đáp ứng chuẩn Production, thay vì phụ thuộc vào việc cấu hình thủ công trên server.
- Nút chọn ngôn ngữ (`LanguageSelector`) hiển thị dạng `<select>` mặc định của trình duyệt gây lỗi UI (vỡ góc, menu sổ xuống bị vuông vức trên Windows) làm mất đi vẻ cao cấp.
- Giới hạn phút chạy miễn phí của GitHub Org cản trở việc chạy các workflow.

Các thay đổi:
- **Kiến trúc Triển khai (Deployment):** Thiết lập rõ ràng luồng phân tán:
  - Frontend: Được quản lý tự động bởi Railway thông qua nhánh `main`.
  - Backend: Chạy trên Google Cloud VM với Docker Compose. Caddy tự động quản lý SSL/TLS.
- **Thiết lập GitHub Actions (CI/CD):**
  - Khởi tạo `.github/workflows/frontend-ci.yml` để Lint và Build kiểm tra frontend.
  - Khởi tạo `.github/workflows/backend-ci.yml` sử dụng công cụ `uv` siêu tốc để chạy bộ test `pytest` cho backend.
  - Khởi tạo `.github/workflows/backend-cd.yml` tự động SSH vào GCP VM và chạy `deploy.sh` mỗi khi có thay đổi trên `main`.
  - Khắc phục giới hạn của GitHub Org bằng cách chuyển đổi sang máy chủ `self-hosted` do BTC cung cấp.
  - Sửa lỗi nén cache `tar` trên các máy chủ `self-hosted` bằng cách tắt tính năng `cache: 'npm'`. Nâng version node lên 22 để tránh deprecation warning.
- **Tối ưu hóa máy chủ (Zero-Downtime):**
  - Tinh chỉnh `deploy.sh`: Loại bỏ lệnh `docker compose down` và `docker builder prune` để tránh sập app kéo dài và bảo tồn bộ đệm 3GB của PyTorch, giúp thời gian khởi động siêu nhanh.
  - Cập nhật chi tiết tài liệu `DEPLOY.md`.
- **Nâng cấp UI (Glassmorphism Dropdown):**
  - Đập bỏ thẻ `<select>` truyền thống trong `frontend/components/LanguageSelector.tsx`.
  - Xây dựng lại thành một Custom Dropdown Component bằng React state (`ul`, `li`), sử dụng các lớp Tailwind (bo tròn góc, kính mờ backdrop-blur, shadow, hiệu ứng hover, focus ring) để mang lại trải nghiệm tinh tế, hoàn toàn đồng bộ trên mọi nền tảng trình duyệt.

Xác nhận:
- Toàn bộ workflows CI/CD đã hoạt động trơn tru.
- Component LanguageSelector hiển thị mượt mà.
- Dự án sẵn sàng cho môi trường Production ổn định.

## 2026-06-27 - Sửa lỗi CI Backend và Deprecation Warnings

Bối cảnh:
- Sau khi thiết lập CI/CD, GitHub Actions cho backend bị lỗi (exit code 1) ở bước chạy test, dù chạy trên máy local Windows vẫn pass 100%.
- Tồn tại các cảnh báo `DeprecationWarning` do sử dụng `datetime.utcnow()`.

Các thay đổi:
- Sửa lỗi cross-loop trong `backend/tests/unit/test_tour_match.py`: Lỗi trên môi trường Linux (CI) do gọi `asyncio.run()` trong môi trường test đồng bộ làm mất kết nối websocket của `TestClient`. Đã thay thế bằng `ws_host.send_json` và đồng bộ qua `update_progress` để tránh treo (infinite loop).
- Sửa các `DeprecationWarning` trong `backend/tests/unit/test_content_analytics.py`: Thay thế `datetime.utcnow()` bằng `datetime.now(timezone.utc).

Xác nhận:
- Chạy `uv run pytest` thành công toàn bộ 244 test pass, 2 skipped, giảm số cảnh báo. Đã sẵn sàng push lên GitHub.

