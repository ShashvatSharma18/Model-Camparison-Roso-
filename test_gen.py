import requests

API_URL = "http://localhost:8000/api"

# 1. Generate
payload = {
    "country": "France",
    "city": "Paris",
    "language": "English",
    "input_json": {},
    "tone": "Casual",
    "content_length": 200,
    "banned_keywords": ["museum", "art"],
    "model_id": "google/gemini-2.0-flash-001"
}
res = requests.post(f"{API_URL}/content/generate", json=payload)
gen_id = res.json()["generation_id"]

# 2. Verify
ver_res = requests.post(f"{API_URL}/content/verify", json={"generation_id": gen_id})
ver_data = ver_res.json()
print("VERIFY ATTEMPT 1:")
for r in ver_data["verification_results"]:
    if r["status"] == "FAIL":
        print(r["parameter"], r["reason"])

# 3. Regenerate
reg_res = requests.post(f"{API_URL}/content/regenerate", json={"generation_id": gen_id})
reg_data = reg_res.json()
print("\nREGENERATE ATTEMPT 2:")
if "verification_results" in reg_data:
    for r in reg_data["verification_results"]:
        if r["status"] == "FAIL":
            print(r["parameter"], r["reason"])

print("\nOUTPUT LENGTH:", len(str(reg_data.get("output_json"))))
