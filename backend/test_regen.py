import requests

# 1. Generate
payload = {
    "country": "France",
    "city": "Paris",
    "language": "English",
    "content_length": 200,
    "model_id": "openai/gpt-4o-mini",
    "tone": "humorous",
    "input_json": {"city": "Paris"}
}
res = requests.post("http://localhost:8000/api/content/generate", json=payload)
print("Gen:", res.status_code)
gen_id = res.json()["generation_id"]

# 2. Verify
ver = requests.post("http://localhost:8000/api/content/verify", json={"generation_id": gen_id})
print("Ver:", ver.status_code)

# 3. Regenerate
reg = requests.post("http://localhost:8000/api/content/regenerate", json={"generation_id": gen_id})
print("Regen:", reg.status_code)
print(reg.json())
