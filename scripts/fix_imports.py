import os

app_dir = r"d:\ai_project\C2-App-060\backend\app"

replacements = {
    "from app.config": "from app.core.config",
    "from app.services.database": "from app.core.database",
    "from app.services.storage": "from app.core.storage",
    "from app.services.embedding": "from app.modules.vision.embedding",
    "from app.services.chroma": "from app.modules.vision.chroma",
    "from app.services.items": "from app.modules.objects.items",
    "from app.services.groups": "from app.modules.objects.groups",
    "from app.services.item_images": "from app.modules.objects.item_images",
    "from app.services import chroma, embedding, storage": "from app.modules.vision import chroma, embedding\nfrom app.core import storage",
    "from app.services import chroma, storage": "from app.modules.vision import chroma\nfrom app.core import storage",
    "from app.services import storage": "from app.core import storage",
    "from app.services import embedding": "from app.modules.vision import embedding",
    "from app.services.rag_service import get_rag_retriever, get_rag_generator": "from app.modules.rag.retriever import get_rag_retriever\nfrom app.modules.llm.generator import get_rag_generator",
    "from app.routers import groups, objects, register, search, generate": "from app.modules.objects import groups_router as groups, objects_router as objects, register_router as register\nfrom app.modules.vision import router as search\nfrom app.modules.llm import router as generate",
}

for root, _, files in os.walk(app_dir):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content
            for old, new in replacements.items():
                new_content = new_content.replace(old, new)
                
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Fixed {path}")
