import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

data = {
    "item_id": None,
    "message": "[SYSTEM_EVENT]: SCANNED_ITEM_ID=1",
    "history": [],
    "visited_item_ids": [1],
    "suggest_next": True
}
try:
    res = requests.post("http://127.0.0.1:8000/api/companion/chat", json=data)
    print("STATUS:", res.status_code)
    print("RESPONSE:", json.dumps(res.json(), ensure_ascii=False, indent=2))
except Exception as e:
    print(e)
