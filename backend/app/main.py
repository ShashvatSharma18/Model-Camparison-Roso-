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
    content_length: int = 2000
    banned_keywords: List[str] = []
    style_guide: Optional[str] = ""
    final_prompt: Optional[str] = ""
    model_id: str

class ContentVerifyRequest(BaseModel):
    generation_id: str

class ContentRegenerateRequest(BaseModel):
    generation_id: str

class SettingsUpdateRequest(BaseModel):
    verifier_model_id: Optional[str] = None
    verify_tone: Optional[bool] = None
    verify_audience: Optional[bool] = None
    verify_content_length: Optional[bool] = None
    verify_banned_keywords: Optional[bool] = None
    verify_style_guide: Optional[bool] = None
    content_length_tolerance_pct: Optional[int] = None
    max_verification_retries: Optional[int] = None
    regeneration_strategy: Optional[str] = None
    field_matching_strictness: Optional[str] = None

def verify_session_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized session token required.")
    token = authorization.split(" ")[1]
    if not token.startswith("sk-or-v1-"):
        raise HTTPException(status_code=401, detail="Invalid OpenRouter API Key in session.")
    return token

@app.post("/api/auth/verify")
def auth_verify(payload: AuthVerifyRequest):
    key = payload.api_key.strip()
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
def get_models(token: str = Depends(verify_session_token)):
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
        "content_length": payload.content_length,
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
    target_len = payload.content_length or 200

    # Explicit Multilingual & Word Count System Prompt Mandate
    system_prompt = f"""You are a professional travel content writer for RosoTravel.
CRITICAL LANGUAGE MANDATE:
Write ALL text string values in the JSON output strictly in {target_lang}. (If language is Hindi, use Hindi Devanagari script).

CRITICAL WORD COUNT MANDATE:
Provide detailed descriptions so the overall total word count is approximately {target_len} words.

Output valid JSON only matching keys: title, introduction, attractions, activities, best_time_to_visit, travel_tips, faqs."""

    # Compile prompt if final_prompt not passed
    if not payload.final_prompt:
        prompt_parts = [
            f"Create travel guide content for {payload.city}, {payload.country} using the provided JSON data:",
            json.dumps(payload.input_json, indent=2),
            f"CRITICAL LANGUAGE MANDATE:\nYou MUST write and translate ALL output text strictly into {target_lang}. Do NOT write in English.",
            f"TARGET WORD COUNT: Provide rich details to reach approx {target_len} words."
        ]
        if payload.tone:
            prompt_parts.append(f"Tone: {payload.tone}")
        if payload.audience:
            prompt_parts.append(f"Audience Variant: {payload.audience}")
        if payload.banned_keywords:
            prompt_parts.append("BANNED KEYWORDS (CRITICAL: DO NOT USE ANY OF THESE WORDS):\n" + "\n".join(["- " + kw for kw in payload.banned_keywords]))
        if payload.style_guide:
            prompt_parts.append(f"Style Guide:\n{payload.style_guide}")

        prompt_parts.append("""
OUTPUT REQUIREMENT:
Return strictly valid JSON matching this structure:
{
  "title": "Title in target language",
  "introduction": "Detailed intro paragraph in target language...",
  "attractions": [{"title": "Name", "description": "Details in target language..."}],
  "activities": ["Activity 1 in target language", "Activity 2..."],
  "best_time_to_visit": "Details in target language...",
  "travel_tips": ["Tip 1 in target language", "Tip 2..."],
  "faqs": [{"question": "Q in target language?", "answer": "A in target language..."}]
}
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
