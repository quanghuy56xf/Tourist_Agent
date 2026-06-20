import sys
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
import os
import re
import sys
import argparse
import urllib.request
import json

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Lỗi khi gọi API {url}: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Tự động cập nhật ID hiện vật vào minimapConfig.ts từ Backend API.")
    parser.add_argument("--api", default="http://localhost:8000/api", help="URL base của Backend API (mặc định: http://localhost:8000/api)")
    parser.add_argument("--config", default="../frontend/lib/minimapConfig.ts", help="Đường dẫn tới file minimapConfig.ts")
    args = parser.parse_args()

    api_base = args.api.rstrip('/')
    config_path = args.config

    if not os.path.exists(config_path):
        print(f"Không tìm thấy file config tại {config_path}. Vui lòng chạy script ở thư mục backend hoặc truyền tham số --config.")
        sys.exit(1)

    print(f"Đang tải danh sách khu di tích từ {api_base}/groups/public ...")
    groups = fetch_json(f"{api_base}/groups/public")
    if groups is None:
        # Thử API /groups (có thể không public)
        groups = fetch_json(f"{api_base}/groups")
        
    if not groups:
        print("Không tìm thấy khu di tích nào hoặc không thể kết nối tới backend.")
        sys.exit(1)

    name_to_id = {}
    for g in groups:
        group_id = g.get('id')
        items_data = fetch_json(f"{api_base}/groups/{group_id}/items")
        if items_data and 'items' in items_data:
            for item in items_data['items']:
                name = item['name'].strip().lower()
                name_to_id[name] = item['id']
                
    print(f"Đã tải {len(name_to_id)} hiện vật từ backend.")

    with open(config_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex tìm các đoạn như: zoneName: "Cổng chính", ... itemIds: [7]
    pattern = r'(zoneName:\s*"([^"]+)",.*?itemIds:\s*\[([^\]]*)\])'

    def replace_func(match):
        full_match = match.group(1)
        zone_name = match.group(2)
        current_ids_str = match.group(3)
        
        lower_zone = zone_name.strip().lower()
        
        matched_id = None
        # Khớp chính xác
        if lower_zone in name_to_id:
            matched_id = name_to_id[lower_zone]
        else:
            # Khớp chuỗi con
            for db_name, db_id in name_to_id.items():
                if lower_zone in db_name or db_name in lower_zone:
                    matched_id = db_id
                    break
                    
        if matched_id is not None:
            # Lấy danh sách ID hiện tại
            ids = [i.strip() for i in current_ids_str.split(',')] if current_ids_str.strip() else []
            if str(matched_id) not in ids:
                ids.append(str(matched_id))
                print(f"✅ Đã thêm ID {matched_id} cho '{zone_name}'")
            else:
                print(f"⚡ ID {matched_id} đã có sẵn cho '{zone_name}'")
                
            new_ids_str = ", ".join(ids)
            new_match = re.sub(r'itemIds:\s*\[[^\]]*\]', f'itemIds: [{new_ids_str}]', full_match)
            return new_match
        else:
            print(f"❌ Không tìm thấy hiện vật nào khớp với tên '{zone_name}' trên backend.")
            return full_match

    new_content = re.sub(pattern, replace_func, content, flags=re.DOTALL)

    with open(config_path, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print(f"\nĐã cập nhật thành công {config_path}.")

if __name__ == "__main__":
    main()
