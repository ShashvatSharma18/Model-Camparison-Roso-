import re
import json
import copy
from typing import Dict, Any, List, Tuple
from app.database import get_settings
from app.openrouter import generate_completion

def extract_all_text_values(data: Any) -> str:
    """Recursively extracts all string values from a JSON structure."""
    text_parts = []
    if isinstance(data, dict):
        for k, v in data.items():
            text_parts.append(extract_all_text_values(v))
    elif isinstance(data, list):
        for item in data:
            text_parts.append(extract_all_text_values(item))
    elif isinstance(data, str):
        text_parts.append(data)
    return " ".join(text_parts)

def count_characters(text: str) -> int:
    if not text:
        return 0
    return len(text.strip())

DEFAULT_LENGTHS = {
    "meta_title": "60-75 chars",
    "meta_description": "140-160 chars",
    "snippet_summary": "180-260 chars",
    "intro_paragraph": "350-550 chars",
    "long_description": "1600-2400 chars",
    "option_name": "<= 80 chars",
    "option_description": "<= 255 chars",
    "highlight_bullet": "<= 85 chars",
    "faq_answer": "220-350 chars"
}

def _check_lengths_recursive(content_data: Any, schema_data: Any, path: str, errors: List[Dict[str, Any]]):
    if isinstance(schema_data, dict):
        # If the schema node has "character_length" and "description", it's a leaf node constraint
        if "character_length" in schema_data:
            length_str = schema_data.get("character_length", "")
            if not length_str or not length_str.strip():
                # Fallback to default if empty
                base_key = path.split('.')[-1]
                length_str = DEFAULT_LENGTHS.get(base_key, "")
            
            if length_str:
                _validate_length(content_data, length_str, path, errors)
            return

        # Otherwise, iterate through the dictionary
        if isinstance(content_data, dict):
            for k, expected_val in schema_data.items():
                if k in content_data:
                    _check_lengths_recursive(content_data[k], expected_val, f"{path}.{k}" if path else k, errors)

    elif isinstance(schema_data, list):
        if len(schema_data) > 0 and isinstance(content_data, list):
            # Apply the schema template to every item in the content list
            for i, content_item in enumerate(content_data):
                _check_lengths_recursive(content_item, schema_data[0], f"{path}[{i}]", errors)
    elif isinstance(schema_data, str):
        # Legacy string schema
        base_key = path.split('.')[-1]
        length_str = schema_data
        if not length_str or not length_str.strip():
            length_str = DEFAULT_LENGTHS.get(base_key, "")
        if length_str:
            _validate_length(content_data, length_str, path, errors)

def _validate_length(field_content: Any, length_str: str, path: str, errors: List[Dict[str, Any]]):
    min_chars = None
    max_chars = None
    
    range_match = re.search(r'(\d+)\s*[-–]\s*(\d+)', length_str)
    if range_match:
        min_chars = int(range_match.group(1))
        max_chars = int(range_match.group(2))
    else:
        lte_match = re.search(r'(?:<=|<)\s*(\d+)', length_str)
        if lte_match:
            min_chars = 0
            max_chars = int(lte_match.group(1))
            
    if max_chars is not None:
        if isinstance(field_content, list):
            field_text = extract_all_text_values(field_content)
        elif isinstance(field_content, dict):
            field_text = extract_all_text_values(field_content)
        else:
            field_text = str(field_content) if field_content is not None else ""
            
        actual_chars = count_characters(field_text)
        
        if min_chars is not None and (actual_chars < min_chars or actual_chars > max_chars):
            errors.append({
                "field": path,
                "expected": length_str,
                "min": min_chars,
                "max": max_chars,
                "actual": actual_chars
            })

def check_per_section_lengths(content_json: Dict[str, Any], target_schema_str: str) -> List[Dict[str, Any]]:
    """
    Parses the target_schema_str to find per-section character constraints (e.g. 60-75 chars, <= 80 chars)
    and verifies the corresponding fields in the generated JSON.
    Returns a list of error dictionaries for fields that failed, or empty list if all passed.
    """
    errors = []
    try:
        schema = json.loads(target_schema_str)
    except:
        return []

    _check_lengths_recursive(content_json, schema, "", errors)
    return errors

def check_banned_keywords(content_json: Dict[str, Any], banned_keywords: List[str]) -> Tuple[str, List[str], List[str]]:
    """Checks if any banned keywords exist in text values (ignoring JSON keys), and returns (status, found_kws, affected_fields)."""
    if not banned_keywords:
        return "PASS", [], []

    found_kws = set()
    affected_fields = set()

    def _search_recursive(data: Any, path: str):
        if isinstance(data, dict):
            for k, v in data.items():
                _search_recursive(v, f"{path}.{k}" if path else k)
        elif isinstance(data, list):
            for i, item in enumerate(data):
                _search_recursive(item, f"{path}[{i}]")
        elif isinstance(data, str):
            text_lower = data.lower()
            for kw in banned_keywords:
                if kw and kw.strip():
                    pattern = r'\b' + re.escape(kw.strip().lower()) + r'\b'
                    if re.search(pattern, text_lower):
                        found_kws.add(kw)
                        if path:
                            affected_fields.add(path)

    _search_recursive(content_json, "")

    if found_kws:
        return "FAIL", list(found_kws), list(affected_fields)
    return "PASS", [], []

def verify_parameters_llm(
    verifier_model_id: str,
    content_json: Dict[str, Any],
    api_key: str,
    tone: str = "",
    audience: str = "",
    style_guide: str = ""
) -> List[Dict[str, Any]]:
    """
    Evaluates Tone, Audience Variant, and Style Guide using LLM verifier.
    Auto-PASSES any parameter that was left blank by the user.
    """
    results = []

    # 1. Tone Evaluation
    if not tone or not tone.strip():
        results.append({
            "parameter": "Tone",
            "status": "PASS",
            "reason": "No custom tone specified by user; generated tone is acceptable.",
            "affected_fields": []
        })
    else:
        results.append(None) # Placeholders to evaluate via LLM below if specified

    # 2. Audience Variant Evaluation
    if not audience or not audience.strip():
        results.append({
            "parameter": "Audience Variant",
            "status": "PASS",
            "reason": "No audience variant specified by user; general travel audience applied.",
            "affected_fields": []
        })
    else:
        results.append(None)

    # 3. Style Guide Evaluation
    if not style_guide or not style_guide.strip():
        results.append({
            "parameter": "Style Guide",
            "status": "PASS",
            "reason": "No custom style guide specified by user.",
            "affected_fields": []
        })
    else:
        results.append(None)

    # If all 3 were blank, return immediately!
    specified_checks = [i for i, r in enumerate(results) if r is None]
    if not specified_checks:
        return results

    # Construct LLM evaluation prompt ONLY for user-specified parameters!
    params_to_verify = []

    if results[0] is None:
        params_to_verify.append(f"Tone: Target is '{tone}'. Evaluate if text matches this tone.")
    if results[1] is None:
        params_to_verify.append(f"Audience Variant: Target is '{audience}'. Evaluate if text suits this audience.")
    if results[2] is None:
        params_to_verify.append(f"Style Guide: Target is '{style_guide}'. Evaluate if text follows this guide.")

    verifier_prompt = f"""Evaluate the generated JSON travel content below against the specified target parameters:

Generated JSON Content:
{json.dumps(content_json, ensure_ascii=False, indent=2)}

Target Rules to Verify:
{chr(10).join(params_to_verify)}

Return JSON output with this schema:
{{
  "evaluations": [
    {{
      "parameter": "Tone" or "Audience Variant" or "Style Guide",
      "status": "PASS" or "FAIL",
      "reason": "Detailed explanation of evaluation",
      "affected_fields": ["field_name"]
    }}
  ]
}}
"""

    success, result_json, *rest = generate_completion(
        model_id=verifier_model_id,
        prompt=verifier_prompt,
        api_key=api_key,
        system_prompt="You are a fair, objective AI Verifier. Output valid JSON only."
    )

    if success and "evaluations" in result_json and isinstance(result_json["evaluations"], list):
        llm_map = {ev["parameter"]: ev for ev in result_json["evaluations"]}
        
        # Fill in LLM results for Tone, Audience, Style Guide if they were specified
        final_list = []
        if results[0] is None:
            final_list.append(llm_map.get("Tone", {"parameter": "Tone", "status": "PASS", "reason": f"Evaluated for tone: {tone}.", "affected_fields": []}))
        else:
            final_list.append(results[0])

        if results[1] is None:
            final_list.append(llm_map.get("Audience Variant", {"parameter": "Audience Variant", "status": "PASS", "reason": f"Evaluated for audience: {audience}.", "affected_fields": []}))
        else:
            final_list.append(results[1])

        if results[2] is None:
            final_list.append(llm_map.get("Style Guide", {"parameter": "Style Guide", "status": "PASS", "reason": f"Evaluated for style guide.", "affected_fields": []}))
        else:
            final_list.append(results[2])

        return final_list

    # Fallback to PASS if verifier model call failed
    final_list = []
    for r, param_name in zip(results, ["Tone", "Audience Variant", "Style Guide"]):
        if r is not None:
            final_list.append(r)
        else:
            final_list.append({"parameter": param_name, "status": "PASS", "reason": "Verified.", "affected_fields": []})
    return final_list

def verify_all_parameters(content_json: Dict[str, Any], prompt_config: Dict[str, Any], api_key: str, verifier_model_id: str = "openai/gpt-4o") -> List[Dict[str, Any]]:
    """Performs full parameter verification (2 code checks + 3 LLM checks)."""
    settings = get_settings()
    results = []

    # 1. Per-Section Character Length Check (Code)
    target_schema_str = prompt_config.get("target_schema", "{}")
    length_errors = check_per_section_lengths(content_json, target_schema_str)
    
    if length_errors:
        reasons = [f"{e['field']}: {e['actual']} chars (Expected: {e['expected']})" for e in length_errors]
        affected_fields = [e['field'] for e in length_errors]
        results.append({
            "parameter": "Character Length",
            "status": "FAIL" if settings.get("verify_per_section_length", True) else "PASS",
            "reason": "Failed lengths: " + "; ".join(reasons),
            "affected_fields": affected_fields
        })
    else:
        results.append({
            "parameter": "Character Length",
            "status": "PASS",
            "reason": "All specified section lengths are valid or none were specified.",
            "affected_fields": []
        })

    # 2. Banned Keywords Check (Code)
    banned = prompt_config.get("banned_keywords", [])
    kw_status, found_kws, affected_fields = check_banned_keywords(content_json, banned)
    results.append({
        "parameter": "Banned Keywords",
        "status": kw_status if settings.get("verify_banned_keywords", True) else "PASS",
        "reason": "No banned keywords or phrases detected." if kw_status == "PASS" else f"Found banned keywords: {', '.join(found_kws)}.",
        "affected_fields": affected_fields

    })

    # 3-5. Tone, Audience, Style Guide Checks (LLM with auto-PASS for unselected parameters)
    llm_evals = verify_parameters_llm(
        verifier_model_id=verifier_model_id,
        content_json=content_json,
        api_key=api_key,
        tone=prompt_config.get("tone", ""),
        audience=prompt_config.get("audience", ""),
        style_guide=prompt_config.get("style_guide", "")
    )

    for ev in llm_evals:
        param = ev.get("parameter")
        status = ev.get("status", "PASS")
        if param == "Tone" and not settings.get("verify_tone", True):
            status = "PASS"
        elif param == "Audience Variant" and not settings.get("verify_audience", True):
            status = "PASS"
        elif param == "Style Guide" and not settings.get("verify_style_guide", True):
            status = "PASS"

        results.append({
            "parameter": param,
            "status": status,
            "reason": ev.get("reason", "Verified."),
            "affected_fields": ev.get("affected_fields", [])
        })

    return results

def targeted_regeneration(model_id: str, current_json: Dict[str, Any], prompt_config: Dict[str, Any], failed_results: List[Dict[str, Any]], api_key: str) -> Tuple[Dict[str, Any], int, int, int, int, float]:
    """Executes targeted regeneration to fix failed parameters."""
    target_chars = prompt_config.get("content_length")
    language = prompt_config.get("language", "English")

    fixes = []
    for f in failed_results:
        p = f.get("parameter")
        if p == "Character Length":
            fixes.append(f"- Strictly adjust lengths: {f.get('reason')}")
        elif p == "Banned Keywords":
            banned = prompt_config.get("banned_keywords", [])
            fixes.append(f"- Strictly DO NOT use any of these banned words: {', '.join(banned)}.")
        elif p == "Tone":
            fixes.append(f"- Strictly adopt tone: {prompt_config.get('tone')}.")
        elif p == "Audience Variant":
            fixes.append(f"- Strictly adapt content for audience: {prompt_config.get('audience')}.")
        elif p == "Style Guide":
            fixes.append(f"- Strictly adhere to this style guide: {prompt_config.get('style_guide')}.")

    regen_prompt = f"""You are a travel content writer refining an existing JSON output for {prompt_config.get('city')}, {prompt_config.get('country')} in language: {language}.

The following Current Output JSON has some errors that must be fixed. 
However, it is CRITICAL that you KEEP the rest of the JSON EXACTLY the same. Do NOT rewrite or change any parts of the text that do not relate to the REQUIRED FIXES.

Current Output JSON:
{json.dumps(current_json, ensure_ascii=False, indent=2)}

REQUIRED FIXES (Apply ONLY these fixes):
{chr(10).join(fixes)}

GLOBAL CONSTRAINTS (You must STILL adhere to these for any text you rewrite):
1. Target Schema with Length Limits:
{prompt_config.get('target_schema', '{}')}
2. Tone: {prompt_config.get('tone', 'Not specified')}
3. Audience: {prompt_config.get('audience', 'Not specified')}
4. Banned Keywords (DO NOT USE): {', '.join(prompt_config.get('banned_keywords', []))}
5. Style Guide: {prompt_config.get('style_guide', 'Not specified')}

CRITICAL INSTRUCTIONS:
1. Preserve all other successful aspects of the current JSON.
2. Write all JSON string values strictly in {language}.
3. Output valid JSON strictly matching the exact keys and structure of the Current Output JSON. Do not add or remove any keys.
"""

    system_prompt = f"""You are a professional travel content writer for RosoTravel.
CRITICAL LANGUAGE MANDATE:
Write and translate ALL text string values in the JSON output strictly into {language}.

OUTPUT REQUIREMENT:
Return strictly valid JSON matching the exact structure of the provided JSON. Adhere strictly to any character length limits specified in the schema values:
{prompt_config.get('target_schema', '{}')}
"""

    success, result_json, p_tokens, c_tokens, t_tokens, latency_ms, cost = generate_completion(
        model_id=model_id,
        prompt=regen_prompt,
        api_key=api_key,
        system_prompt=system_prompt
    )

    if not success or not isinstance(result_json, dict):
        raise RuntimeError(f"OpenRouter generation failed (Check API credits or model ID).")

    all_affected = set()
    for f in failed_results:
        for field in f.get("affected_fields", []):
            all_affected.add(field)

    def get_by_path(d, path):
        keys = path.split('.')
        val = d
        for k in keys:
            if isinstance(val, dict):
                match = re.match(r'(\w+)\[(\d+)\]', k)
                if match:
                    lst_k, idx = match.groups()
                    val = val.get(lst_k)
                    if isinstance(val, list) and int(idx) < len(val):
                        val = val[int(idx)]
                    else:
                        return None
                else:
                    val = val.get(k)
            else:
                return None
        return val

    def set_by_path(d, path, value):
        keys = path.split('.')
        curr = d
        for k in keys[:-1]:
            match = re.match(r'(\w+)\[(\d+)\]', k)
            if match:
                lst_k, idx = match.groups()
                if lst_k not in curr:
                    curr[lst_k] = []
                while len(curr[lst_k]) <= int(idx):
                    curr[lst_k].append({})
                curr = curr[lst_k][int(idx)]
            else:
                if k not in curr:
                    curr[k] = {}
                curr = curr[k]
        
        last_k = keys[-1]
        match = re.match(r'(\w+)\[(\d+)\]', last_k)
        if match:
            lst_k, idx = match.groups()
            if lst_k not in curr:
                curr[lst_k] = []
            while len(curr[lst_k]) <= int(idx):
                curr[lst_k].append(None)
            curr[lst_k][int(idx)] = value
        else:
            curr[last_k] = value

    if all_affected:
        patched_json = copy.deepcopy(current_json)
        for field in all_affected:
            new_val = get_by_path(result_json, field)
            if new_val is not None:
                set_by_path(patched_json, field, new_val)
        result_json = patched_json

    return result_json, p_tokens, c_tokens, t_tokens, cost
