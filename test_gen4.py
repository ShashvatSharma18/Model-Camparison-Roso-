import requests

API_URL = "http://localhost:8000/api"

payload = {
    "country": "France",
    "city": "Paris",
    "language": "English",
    "input_json": {},
    "tone": "Casual",
    "content_length": 2000,
    "banned_keywords": ["museum", "art"],
    "model_id": "google/gemini-2.0-flash-001"
}
res = requests.post(f"{API_URL}/content/generate", json=payload)
gen_id = res.json()["generation_id"]

ver_res = requests.post(f"{API_URL}/content/verify", json={"generation_id": gen_id})
ver_data = ver_res.json()
print("VERIFY:", [r for r in ver_data["verification_results"] if r["status"] == "FAIL"])

reg_res = requests.post(f"{API_URL}/content/regenerate", json={"generation_id": gen_id})
reg_data = reg_res.json()
print("REGENERATE:", [r for r in reg_data.get("verification_results", []) if r["status"] == "FAIL"])
