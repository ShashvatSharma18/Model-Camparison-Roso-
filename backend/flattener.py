def flatten_llm_output(data):
    if isinstance(data, dict):
        # If it's the exact instruction dict format, extract 'description'
        if "description" in data and "character_length" in data:
            return data["description"]
        
        # Otherwise, process recursively
        for k, v in data.items():
            data[k] = flatten_llm_output(v)
        return data
    elif isinstance(data, list):
        return [flatten_llm_output(item) for item in data]
    else:
        return data

example = {
  "meta_title": {
    "description": "Paris Family Travel Guide: Top Sights, Activities and Tips | RosoTravel",
    "character_length": "60-75 chars"
  },
  "attractions": [
    {
      "name": {
        "description": "Eiffel Tower",
        "character_length": "<= 80 chars"
      }
    }
  ]
}

import json
print(json.dumps(flatten_llm_output(example), indent=2))
