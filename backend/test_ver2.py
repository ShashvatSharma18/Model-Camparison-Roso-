import json
from app.verification import verify_parameters_llm

# Simulate fallback path by passing a fake invalid API key or forcing a failure
# Actually, we can just look at the code:
results = [
    {"parameter": "Character Length", "status": "PASS"},
    {"parameter": "Banned Keywords", "status": "PASS"},
    None,
    None,
    None
]
final_list = []
for r, param_name in zip(results, ["Tone", "Audience Variant", "Style Guide"]):
    if r is not None:
        final_list.append(r)
    else:
        final_list.append({"parameter": param_name, "status": "PASS", "reason": "Verified.", "affected_fields": []})

print("Fallback final_list length:", len(final_list))
print(json.dumps(final_list, indent=2))
