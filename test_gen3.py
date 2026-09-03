import requests

API_URL = "http://localhost:8000/api"

payload = {
    "country": "France",
    "city": "Paris",
    "language": "English",
    "input_json": {},
    "tone": "Casual",
    "content_length": 200,
    "banned_keywords": ["museum", "art", "perfect"],
    "model_id": "google/gemini-2.0-flash-001"
}
res = requests.post(f"{API_URL}/content/generate", json=payload)
gen_id = res.json()["generation_id"]

ver_res = requests.post(f"{API_URL}/content/verify", json={"generation_id": gen_id})
ver_data = ver_res.json()
print("VERIFY:", [r for r in ver_data["verification_results"] if r["status"] == "FAIL"])

