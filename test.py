import requests

groups_res = requests.get('http://localhost:8000/api/groups')
print(groups_res.json())

if groups_res.ok and len(groups_res.json()) > 0:
    group_id = groups_res.json()[0]['id']
    items_res = requests.get(f'http://localhost:8000/api/groups/{group_id}/items')
    print(items_res.json())
