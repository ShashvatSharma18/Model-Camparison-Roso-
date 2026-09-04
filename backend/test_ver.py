import json
from app.verification import verify_all_parameters, check_per_section_lengths

schema = '{"meta_title": "60-75 chars"}'
content = {"meta_title": "This is a short title."}
print("Length errors:", check_per_section_lengths(content, schema))

config = {"target_schema": schema}
results = verify_all_parameters(content, config, "")
print("Verification results:", json.dumps(results, indent=2))
