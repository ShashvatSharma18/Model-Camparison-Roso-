import json
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import POC_SECRET_KEY
from app.openrouter import fetch_openrouter_models, generate_completion
from app.database import (
    get_settings, update_settings, find_matching_test_run, create_test_run,
    save_generation, update_generation_record, save_verification_results, save_regeneration,
    get_history_runs, get_run_details, get_comparison_runs, get_used_models_for_test_run
)
from app.verification import verify_all_parameters, targeted_regeneration

app = FastAPI(title="RosoTravel AI Content Generation POC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthVerifyRequest(BaseModel):
    api_key: str

class ContentGenerateRequest(BaseModel):
    country: str = "France"
    city: str = "Paris"
    language: str = "English"
    input_json: Dict[str, Any]
    tone: Optional[str] = ""
    audience: Optional[str] = ""
    target_schema: Optional[str] = None
    banned_keywords: List[str] = []
    style_guide: Optional[str] = ""
    final_prompt: Optional[str] = ""
    model_id: str

class ContentVerifyRequest(BaseModel):
    generation_id: str

class ContentRegenerateRequest(BaseModel):
    generation_id: str

class ContentTranslationRequest(BaseModel):
    source_generation_id: str
    target_language: str
    model_id: str

class SettingsUpdateRequest(BaseModel):
    verifier_model_id: Optional[str] = None
    verify_tone: Optional[bool] = None
    verify_audience: Optional[bool] = None
    verify_per_section_length: Optional[bool] = None
    verify_banned_keywords: Optional[bool] = None
    verify_style_guide: Optional[bool] = None
    content_length_tolerance_pct: Optional[int] = None
    max_verification_retries: Optional[int] = None
    regeneration_strategy: Optional[str] = None
    field_matching_strictness: Optional[str] = None
    enabled_generation_models: Optional[list[str]] = None
    enabled_translation_models: Optional[list[str]] = None

def verify_session_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized session token required.")
    token = authorization.split(" ")[1]
    if not token.startswith("sk-or-v1-"):
        raise HTTPException(status_code=401, detail="Invalid OpenRouter API Key in session.")
    return token

def optional_session_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return ""
    token = authorization.split(" ")[1]
    if not token.startswith("sk-or-v1-"):
        return ""
    return token

@app.post("/api/auth/verify")
def auth_verify(payload: AuthVerifyRequest):
    key = payload.api_key.strip() if payload.api_key else ""
    if not key.startswith("sk-or-v1-"):
        raise HTTPException(status_code=401, detail="Invalid OpenRouter API key format.")
    
    headers = {"Authorization": f"Bearer {key}"}
    try:
        import requests
        resp = requests.get("https://openrouter.ai/api/v1/auth/key", headers=headers, timeout=10)
        if resp.status_code == 200:
            return {
                "success": True,
                "message": "Authentication successful.",
                "token": key
            }
    except Exception:
        pass
    raise HTTPException(status_code=401, detail="Invalid OpenRouter API key. Please check your key and try again.")

@app.get("/api/models")
def get_models(token: str = Depends(optional_session_token)):
    return fetch_openrouter_models(api_key=token)

@app.get("/api/settings")
def get_app_settings_route():
    return get_settings()

@app.post("/api/settings")
def update_app_settings_route(payload: SettingsUpdateRequest):
    data = {k: v for k, v in payload.dict().items() if v is not None}
    return update_settings(data)

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    history = get_history_runs()
    total_runs = len(history)
    successful_runs = sum(1 for h in history if (h.get("status") or "").lower() in ["verified", "regenerated", "pass"])
    regenerated_runs = sum(1 for h in history if (h.get("status") or "").lower() == "regenerated")
    total_tokens = sum(h.get("total_tokens", 0) for h in history)
    total_cost = round(sum(h.get("cost", 0.0) for h in history), 4)
    avg_latency_ms = int(sum(h.get("latency_ms", 0) for h in history) / total_runs) if total_runs > 0 else 0

    return {
        "total_runs": total_runs,
        "successful_runs": successful_runs,
        "regenerated_runs": regenerated_runs,
        "avg_latency_sec": round(avg_latency_ms / 1000.0, 2),
        "total_tokens": total_tokens,
        "total_cost": total_cost,
        "recent_runs": history[:10]
    }

@app.get("/api/test-runs/{test_run_id}/models")
def get_test_run_used_models(test_run_id: str):
    return get_used_models_for_test_run(test_run_id)

@app.post("/api/content/generate")
def generate_content_endpoint(payload: ContentGenerateRequest, token: str = Depends(verify_session_token)):
    if not payload.model_id:
        raise HTTPException(status_code=400, detail="Please select an OpenRouter model before generating content.")

    prompt_config = {
        "tone": payload.tone or "",
        "audience": payload.audience or "",
        "target_schema": payload.target_schema,
        "banned_keywords": payload.banned_keywords,
        "style_guide": payload.style_guide or "",
        "final_prompt": payload.final_prompt or "",
        "language": payload.language or "English"
    }

    # Lookup or create Test Run
    existing_tr_id = find_matching_test_run(
        country=payload.country,
        city=payload.city,
        language=payload.language or "English",
        input_json=payload.input_json,
        prompt_config=prompt_config
    )
    if existing_tr_id:
        test_run_id = existing_tr_id
    else:
        test_run_id = create_test_run(
            country=payload.country,
            city=payload.city,
            language=payload.language or "English",
            input_json=payload.input_json,
            prompt_config=prompt_config
        )

    target_lang = payload.language or "English"
    target_schema_str = payload.target_schema or "{}"

    if target_lang.lower() == "english":
        lang_mandate = f"Write ALL text string values in the JSON output strictly in English."
    elif target_lang.lower() == "hindi":
        lang_mandate = f"Write and translate ALL text string values in the JSON output strictly into Hindi using Devanagari script. Do NOT write in English. IMPORTANT: Even if the input JSON, target schema keys, or descriptions are written in English, the final generated string values MUST be in Hindi."
    else:
        lang_mandate = f"Write and translate ALL text string values in the JSON output strictly into {target_lang}. Do NOT write in English. IMPORTANT: Even if the input JSON, target schema keys, or descriptions are written in English, the final generated string values MUST be in {target_lang}."

    # Explicit Multilingual System Prompt Mandate
    system_prompt = f"""You are a professional travel content writer for RosoTravel.
CRITICAL LANGUAGE MANDATE:
{lang_mandate}

OUTPUT REQUIREMENT:
Return strictly valid JSON matching the following TARGET SCHEMA exactly. Adhere strictly to any character length limits specified in the schema values:
{target_schema_str}
"""

    # Compile prompt if final_prompt not passed
    if not payload.final_prompt:
        prompt_parts = [
            f"Create travel guide content for {payload.city}, {payload.country} using the provided JSON data:",
            json.dumps(payload.input_json, indent=2),
            f"CRITICAL LANGUAGE MANDATE:\n{lang_mandate}"
        ]
        if payload.tone:
            prompt_parts.append(f"Tone: {payload.tone}")
        if payload.audience:
            prompt_parts.append(f"Audience Variant: {payload.audience}")
        if payload.banned_keywords:
            prompt_parts.append("BANNED KEYWORDS (CRITICAL: DO NOT USE ANY OF THESE WORDS):\n" + "\n".join(["- " + kw for kw in payload.banned_keywords]))
        if payload.style_guide:
            prompt_parts.append(f"Style Guide:\n{payload.style_guide}")

        prompt_parts.append(f"""
OUTPUT REQUIREMENT:
Return strictly valid JSON matching this structure and constraints exactly:
{target_schema_str}
""")
        compiled_prompt = "\n\n".join(prompt_parts)
    else:
        compiled_prompt = payload.final_prompt

    models = fetch_openrouter_models(api_key=token)
    selected_model_name = next((m["name"] for m in models if m["id"] == payload.model_id), payload.model_id)

    gen_success, output_json, in_t, out_t, tot_t, lat_ms, cost = generate_completion(
        model_id=payload.model_id,
        prompt=compiled_prompt,
        api_key=token,
        system_prompt=system_prompt
    )

    if not gen_success or not output_json:
        error_msg = output_json.get("error", "Failed to generate valid content JSON.") if isinstance(output_json, dict) else "Content generation failed."
        save_generation(
            test_run_id=test_run_id,
            model_id=payload.model_id,
            model_name=selected_model_name,
            attempt_number=1,
            output_json={"error": error_msg},
            status="Failed",
            input_tokens=in_t,
            output_tokens=out_t,
            total_tokens=tot_t,
            latency_ms=lat_ms,
            cost=cost
        )
        raise HTTPException(status_code=500, detail=error_msg)

    gen_id = save_generation(
        test_run_id=test_run_id,
        model_id=payload.model_id,
        model_name=selected_model_name,
        attempt_number=1,
        output_json=output_json,
        status="Unverified",
        input_tokens=in_t,
        output_tokens=out_t,
        total_tokens=tot_t,
        latency_ms=lat_ms,
        cost=cost
    )

    return {
        "success": True,
        "generation_id": gen_id,
        "test_run_id": test_run_id,
        "status": "Unverified",
        "output_json": output_json,
        "metrics": {
            "input_tokens": in_t,
            "output_tokens": out_t,
            "total_tokens": tot_t,
            "latency_ms": lat_ms,
            "cost": cost
        }
    }

@app.post("/api/content/translate")
def translate_content_endpoint(payload: ContentTranslationRequest, token: str = Depends(verify_session_token)):
    if not payload.model_id:
        raise HTTPException(status_code=400, detail="Please select an OpenRouter model before generating translation.")
    if payload.target_language not in ["German", "Spanish", "Polish", "Italian", "French"]:
        raise HTTPException(status_code=400, detail="Invalid target language. Must be one of: German, Spanish, Polish, Italian, French.")
        
    history = get_history_runs()
    source_gen = next((g for g in history if g.get("run_id") == payload.source_generation_id or g.get("id") == payload.source_generation_id), None)
    if not source_gen:
        raise HTTPException(status_code=404, detail="Source generation not found.")
        
    details = get_run_details(payload.source_generation_id)
    if not details or "generation" not in details:
        raise HTTPException(status_code=404, detail="Source generation details not found.")
        
    source_json = details["generation"].get("output_json", {})
    if not source_json:
        raise HTTPException(status_code=400, detail="Source generation is empty.")
    
    source_test_run = details.get("test_run", {})
    source_prompt_config = details.get("prompt_config", {})
    
    new_prompt_config = dict(source_prompt_config)
    new_prompt_config["language"] = payload.target_language
    new_prompt_config["is_translation"] = True
    new_prompt_config["source_generation_id"] = payload.source_generation_id
    
    test_run_id = create_test_run(
        country=source_test_run.get("country", "Unknown"),
        city=source_test_run.get("city", "Unknown"),
        language=payload.target_language,
        input_json=source_test_run.get("input_json", {}),
        prompt_config=new_prompt_config,
        task_type="Translation"
    )
    
    system_prompt = f"""You are an expert localization engine. Translate the provided JSON into {payload.target_language}, adhering STRICTLY to the following rules:

1. Translation rules (mandatory): Never translate:
   - factual fields — exact wording
   - ecommerce properties (price, currency, meeting point) — exact wording
   - place names (detected via Named-Entity Recognition) — exact wording
   - keywords marked as "locked" — exact wording

2. Token preservation:
   - {{{{City_Name}}}}, {{{{Attraction_Name}}}} tokens stay exactly as tokens — explicitly stated
   - Translate but keep {{{{City_Name}}}} unchanged.

3. Fields NEVER translated (schema):
   - geo, address, openingHoursSpecification — listed explicitly

4. CMS static pages:
   - Never overwrite LOCKED blocks (hard)
   - Block state machine (AUTO / EDITED / LOCKED / OUTDATED) — all explicitly defined

5. URLs and Linking:
   - Header links never change by language; only the labels are translated. URLs remain the same structure with language prefix.

OUTPUT REQUIREMENT:
Return strictly valid JSON matching the exact structure of the provided input JSON.
"""

    prompt = f"Translate the following JSON content into {payload.target_language} adhering strictly to the system rules:\n\n{json.dumps(source_json, indent=2)}"
    
    models = fetch_openrouter_models(api_key=token)
    selected_model_name = next((m["name"] for m in models if m["id"] == payload.model_id), payload.model_id)

    gen_success, output_json, in_t, out_t, tot_t, lat_ms, cost = generate_completion(
        model_id=payload.model_id,
        prompt=prompt,
        api_key=token,
        system_prompt=system_prompt
    )
    
    if not gen_success or not output_json:
        error_msg = output_json.get("error", "Failed to generate translation JSON.") if isinstance(output_json, dict) else "Translation generation failed."
        save_generation(
            test_run_id=test_run_id,
            model_id=payload.model_id,
            model_name=selected_model_name,
            attempt_number=1,
            output_json={"error": error_msg},
            status="Failed",
            input_tokens=in_t,
            output_tokens=out_t,
            total_tokens=tot_t,
            latency_ms=lat_ms,
            cost=cost
        )
        raise HTTPException(status_code=500, detail=error_msg)

    gen_id = save_generation(
        test_run_id=test_run_id,
        model_id=payload.model_id,
        model_name=selected_model_name,
        attempt_number=1,
        output_json=output_json,
        status="Verified",
        input_tokens=in_t,
        output_tokens=out_t,
        total_tokens=tot_t,
        latency_ms=lat_ms,
        cost=cost
    )

    return {
        "success": True,
        "generation_id": gen_id,
        "test_run_id": test_run_id,
        "output_json": output_json,
        "metrics": {
            "total_tokens": tot_t,
            "latency_ms": lat_ms,
            "cost": cost
        }
    }

@app.post("/api/content/verify")
def verify_content_endpoint(payload: ContentVerifyRequest, token: str = Depends(verify_session_token)):
    run_detail = get_run_details(payload.generation_id)
    if not run_detail:
        raise HTTPException(status_code=404, detail="Generation run not found.")

    gen = run_detail["generation"]
    prompt_config = run_detail["prompt_config"]
    settings = get_settings()
    verifier_model_id = settings.get("verifier_model_id", "openai/gpt-4o")

    attempt_num = gen.get("attempt_number", 1)
    results = verify_all_parameters(
        content_json=gen["output_json"],
        prompt_config=prompt_config,
        api_key=token,
        verifier_model_id=verifier_model_id
    )

    save_verification_results(
        generation_id=payload.generation_id,
        verification_attempt=attempt_num,
        results=results
    )

    has_failures = any(r["status"] == "FAIL" for r in results)
    final_status = "Failed" if has_failures else ("Regenerated" if attempt_num > 1 else "Verified")

    update_generation_record(payload.generation_id, {"status": final_status})

    return {
        "success": True,
        "generation_id": payload.generation_id,
        "status": final_status,
        "verification_attempt": attempt_num,
        "verifier_model_id": verifier_model_id,
        "verification_results": results
    }

@app.post("/api/content/regenerate")
def regenerate_content_endpoint(payload: ContentRegenerateRequest, token: str = Depends(verify_session_token)):
    run_detail = get_run_details(payload.generation_id)
    if not run_detail:
        raise HTTPException(status_code=404, detail="Generation run not found.")

    gen = run_detail["generation"]
    prompt_config = run_detail["prompt_config"]
    verification_results = run_detail["verification_results"]

    if verification_results:
        max_attempt = max(r.get("verification_attempt", 1) for r in verification_results)
        latest_results = [r for r in verification_results if r.get("verification_attempt", 1) == max_attempt]
    else:
        latest_results = []

    failed_results = [r for r in latest_results if r["status"] == "FAIL"]
    if not failed_results:
        return {
            "success": True,
            "message": "No failed parameters found. Generation already meets all verification criteria.",
            "status": gen.get("status", "Verified"),
            "output_json": gen["output_json"],
            "verification_results": verification_results
        }

    try:
        new_output, p_tok, c_tok, t_tok, cost = targeted_regeneration(
            model_id=gen["model_id"],
            current_json=gen["output_json"],
            prompt_config=prompt_config,
            failed_results=failed_results,
            api_key=token
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    new_attempt = gen.get("attempt_number", 1) + 1

    save_regeneration(
        generation_id=payload.generation_id,
        parameter=failed_results[0]["parameter"],
        previous_output=gen["output_json"],
        new_output=new_output,
        reason=failed_results[0].get("reason", "Targeted parameter regeneration.")
    )

    settings = get_settings()
    verifier_model_id = settings.get("verifier_model_id", "openai/gpt-4o")

    new_ver_results = verify_all_parameters(
        content_json=new_output,
        prompt_config=prompt_config,
        api_key=token,
        verifier_model_id=verifier_model_id
    )

    save_verification_results(
        generation_id=payload.generation_id,
        verification_attempt=new_attempt,
        results=new_ver_results
    )

    has_failures = any(r["status"] == "FAIL" for r in new_ver_results)
    final_status = "Regenerated" if not has_failures else "Failed"

    update_generation_record(payload.generation_id, {
        "output_json": new_output,
        "attempt_number": new_attempt,
        "status": final_status,
        "total_tokens": gen.get("total_tokens", 0) + t_tok,
        "cost": round(gen.get("cost", 0.0) + cost, 4)
    })

    return {
        "success": True,
        "generation_id": payload.generation_id,
        "status": final_status,
        "attempts": new_attempt,
        "output_json": new_output,
        "verification_results": new_ver_results
    }

@app.get("/api/history")
def get_history():
    return get_history_runs()

@app.get("/api/history/{run_id}")
def get_history_run_details(run_id: str):
    detail = get_run_details(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Run not found.")
    return detail

@app.get("/api/comparison/{test_run_id}")
def get_comparison(test_run_id: str):
    return get_comparison_runs(test_run_id)
