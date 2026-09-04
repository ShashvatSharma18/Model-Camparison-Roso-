from app.database import _in_memory_db
import json

print(json.dumps(_in_memory_db["prompt_configs"][-1], indent=2))
