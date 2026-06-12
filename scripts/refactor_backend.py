import os
import shutil

app_dir = r"d:\ai_project\C2-App-060\backend\app"

dirs = [
    "core", 
    "modules/vision", 
    "modules/rag", 
    "modules/llm", 
    "modules/objects", 
    "modules/auth"
]

for d in dirs:
    os.makedirs(os.path.join(app_dir, d), exist_ok=True)

moves = [
    ("config.py", "core/config.py"),
    ("services/database.py", "core/database.py"),
    ("services/storage.py", "core/storage.py"),
    ("services/embedding.py", "modules/vision/embedding.py"),
    ("services/chroma.py", "modules/vision/chroma.py"),
    ("services/items.py", "modules/objects/items.py"),
    ("services/groups.py", "modules/objects/groups.py"),
    ("services/item_images.py", "modules/objects/item_images.py"),
    ("routers/search.py", "modules/vision/router.py"),
    ("routers/generate.py", "modules/llm/router.py"),
    ("routers/groups.py", "modules/objects/groups_router.py"),
    ("routers/objects.py", "modules/objects/objects_router.py"),
    ("routers/register.py", "modules/objects/register_router.py"),
]

for src, dst in moves:
    src_path = os.path.join(app_dir, src.replace("/", "\\"))
    dst_path = os.path.join(app_dir, dst.replace("/", "\\"))
    if os.path.exists(src_path):
        shutil.move(src_path, dst_path)

print("Files moved successfully.")
