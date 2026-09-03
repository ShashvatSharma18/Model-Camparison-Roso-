import requests
import json

API_URL = "http://localhost:8000/api"

payload = {
    "country": "France",
    "city": "Paris",
    "language": "English",
    "input_json": {},
    "tone": "Casual",
    "content_length": 2000,
    "banned_keywords": ["Louvre", "museum", "art"],
    "model_id": "google/gemini-2.0-flash-001"
}
res = requests.post(f"{API_URL}/content/generate", json=payload)
gen_id = res.json()["generation_id"]

reg_res = requests.post(f"{API_URL}/content/regenerate", json={"generation_id": gen_id})
print("REGENERATE ATTEMPT 2 HTTP STATUS:", reg_res.status_code)
print("REGENERATE ATTEMPT 2 BODY:")
print(json.dumps(reg_res.json(), indent=2))
