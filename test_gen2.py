import requests

API_URL = "http://localhost:8000/api"
gen_id = "eebbf381-2ff5-4628-b3b8-3fbd6c285c72"  # Let's get the latest generation

# Regenerate
reg_res = requests.post(f"{API_URL}/content/regenerate", json={"generation_id": gen_id})
reg_data = reg_res.json()
if "output_json" in reg_data:
    print(reg_data["output_json"]["introduction"])
else:
    print(reg_data)
