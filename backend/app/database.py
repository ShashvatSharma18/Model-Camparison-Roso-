import uuid
import datetime
from typing import Dict, Any, List, Optional

import os
from supabase import create_client, Client

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if supabase_url and supabase_key:
    try:
        supabase_client: Client = create_client(supabase_url, supabase_key)
    except Exception as e:
        print(f"Failed to initialize Supabase client (Invalid API key?): {e}")
        supabase_client = None
else:
    supabase_client = None

_in_memory_db = {
    "test_runs": [],
    "prompt_configs": [],
    "generations": [],
    "verification_results": [],
    "regenerations": []
}

def get_settings() -> Dict[str, Any]:
    default_settings = {
        "verifier_model_id": "openai/gpt-4o",
        "verify_tone": True,
        "verify_audience": True,
        "verify_content_length": True,
        "verify_banned_keywords": True,
        "verify_style_guide": True,
        "content_length_tolerance_pct": 50,
        "max_verification_retries": 3,
        "regeneration_strategy": "targeted",
        "field_matching_strictness": "moderate"
    }

    if supabase_client:
        try:
            res = supabase_client.table("app_settings").select("*").limit(1).execute()
            if res.data and len(res.data) > 0:
                return {**default_settings, **res.data[0]}
        except Exception as e:
            print(f"Supabase fetch settings error: {e}")

    return default_settings

def update_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    current = get_settings()
    updated = {**current, **new_settings}

    if supabase_client:
        try:
            res = supabase_client.table("app_settings").select("id").limit(1).execute()
            if res.data and len(res.data) > 0:
                settings_id = res.data[0]["id"]
                supabase_client.table("app_settings").update(updated).eq("id", settings_id).execute()
            else:
                updated["id"] = str(uuid.uuid4())
                supabase_client.table("app_settings").insert(updated).execute()
        except Exception as e:
            print(f"Supabase update settings error: {e}")

    return updated

def find_matching_test_run(country: str, city: str, language: str, input_json: Dict[str, Any], prompt_config: Dict[str, Any]) -> Optional[str]:
    """Finds an existing matching test_run_id for the given location & input."""
    for tr in reversed(_in_memory_db["test_runs"]):
        if (tr.get("country", "").lower() == country.lower() and
            tr.get("city", "").lower() == city.lower() and
            tr.get("language", "").lower() == language.lower()):
            return tr["id"]

    if supabase_client:
        try:
            res = supabase_client.table("test_runs").select("*").order("created_at", desc=True).limit(10).execute()
            if res.data:
                for tr in res.data:
                    if (tr.get("country", "").lower() == country.lower() and
                        tr.get("city", "").lower() == city.lower() and
                        tr.get("language", "").lower() == language.lower()):
                        return tr["id"]
        except Exception as e:
            print(f"Supabase search test run error: {e}")

    return None

def create_test_run(country: str, city: str, language: str, input_json: Dict[str, Any], prompt_config: Dict[str, Any]) -> str:
    test_run_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    tr_record = {
        "id": test_run_id,
        "country": country,
        "city": city,
        "language": language,
        "input_json": input_json,
        "created_at": now
    }
    _in_memory_db["test_runs"].append(tr_record)

    pc_record = {
        "id": str(uuid.uuid4()),
        "test_run_id": test_run_id,
        "tone": prompt_config.get("tone", ""),
        "audience": prompt_config.get("audience", ""),
        "content_length": prompt_config.get("content_length", 200),
        "banned_keywords": prompt_config.get("banned_keywords", []),
        "style_guide": prompt_config.get("style_guide", ""),
        "final_prompt": prompt_config.get("final_prompt", ""),
        "created_at": now
    }
    _in_memory_db["prompt_configs"].append(pc_record)

    if supabase_client:
        try:
            supabase_client.table("test_runs").insert(tr_record).execute()
            supabase_client.table("prompt_configs").insert(pc_record).execute()
        except Exception as e:
            print(f"Supabase insert test run error: {e}")

    return test_run_id

def save_generation(
    test_run_id: str,
    model_id: str,
    model_name: str,
    attempt_number: int,
    output_json: Dict[str, Any],
    status: str = "Unverified",
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    latency_ms: int = 0,
    cost: float = 0.0
) -> str:
    gen_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    rec = {
        "id": gen_id,
        "test_run_id": test_run_id,
        "model_id": model_id,
        "model_name": model_name,
        "attempt_number": attempt_number,
        "output_json": output_json,
        "status": status,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "latency_ms": latency_ms,
        "cost": cost,
        "created_at": now
    }
    _in_memory_db["generations"].append(rec)

    if supabase_client:
        try:
            supabase_client.table("generations").insert(rec).execute()
        except Exception as e:
            print(f"Supabase insert generation error: {e}")

    return gen_id

def update_generation_record(generation_id: str, update_data: Dict[str, Any]):
    gen = next((g for g in _in_memory_db["generations"] if g["id"] == generation_id), None)
    if gen:
        gen.update(update_data)

    if supabase_client:
        try:
            supabase_client.table("generations").update(update_data).eq("id", generation_id).execute()
        except Exception as e:
            print(f"Supabase update generation error: {e}")

def save_verification_results(generation_id: str, verification_attempt: int, results: List[Dict[str, Any]]):
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    records = []
    for r in results:
        rec = {
            "id": str(uuid.uuid4()),
            "generation_id": generation_id,
            "verification_attempt": verification_attempt,
            "parameter": r["parameter"],
            "status": r["status"],
            "reason": r.get("reason", ""),
            "affected_fields": r.get("affected_fields", []),
            "created_at": now
        }
        records.append(rec)
        _in_memory_db["verification_results"].append(rec)

    if supabase_client:
        try:
            supabase_client.table("verification_results").insert(records).execute()
        except Exception as e:
            print(f"Supabase verification insert error: {e}")

def save_regeneration(generation_id: str, parameter: str, previous_output: Dict[str, Any], new_output: Dict[str, Any], reason: str):
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    rec = {
        "id": str(uuid.uuid4()),
        "generation_id": generation_id,
        "parameter": parameter,
        "previous_output": previous_output,
        "new_output": new_output,
        "reason": reason,
        "created_at": now
    }
    _in_memory_db["regenerations"].append(rec)
    if supabase_client:
        try:
            supabase_client.table("regenerations").insert(rec).execute()
        except Exception as e:
            print(f"Supabase regeneration insert error: {e}")

def get_history_runs() -> List[Dict[str, Any]]:
    """Returns ALL generations combining Supabase and memory (deduplicated by run_id)."""
    history_map = {}

    # 1. Load from Supabase if configured
    if supabase_client:
        try:
            res = supabase_client.table("generations").select("*, test_runs(*)").order("created_at", desc=True).execute()
            if res.data and len(res.data) > 0:
                for g in res.data:
                    tr = g.get("test_runs") or {}
                    history_map[g["id"]] = {
                        "run_id": g["id"],
                        "test_run_id": g["test_run_id"],
                        "country": tr.get("country", "France"),
                        "city": tr.get("city", "Paris"),
                        "language": tr.get("language", "English"),
                        "model": g.get("model_name", g["model_id"]),
                        "model_id": g["model_id"],
                        "attempt_number": g.get("attempt_number", 1),
                        "status": g.get("status", "Verified"),
                        "latency_ms": g.get("latency_ms", 0),
                        "total_tokens": g.get("total_tokens", 0),
                        "cost": g.get("cost", 0.0),
                        "created_at": g.get("created_at")
                    }
        except Exception as e:
            print(f"Supabase history query error: {e}")

    # 2. Add in-memory generations (only those not already from Supabase)
    for g in reversed(_in_memory_db["generations"]):
        if g["id"] not in history_map:
            tr = next((t for t in _in_memory_db["test_runs"] if t["id"] == g["test_run_id"]), {})
            history_map[g["id"]] = {
                "run_id": g["id"],
                "test_run_id": g["test_run_id"],
                "country": tr.get("country", "France"),
                "city": tr.get("city", "Paris"),
                "language": tr.get("language", "English"),
                "model": g.get("model_name", g["model_id"]),
                "model_id": g["model_id"],
                "attempt_number": g.get("attempt_number", 1),
                "status": g.get("status", "Verified"),
                "latency_ms": g.get("latency_ms", 0),
                "total_tokens": g.get("total_tokens", 0),
                "cost": g.get("cost", 0.0),
                "created_at": g.get("created_at")
            }

    return list(history_map.values())

def get_used_models_for_test_run(test_run_id: str) -> List[str]:
    used = set()
    for g in _in_memory_db["generations"]:
        if g.get("test_run_id") == test_run_id:
            used.add(g.get("model_id"))
    return list(used)

def get_run_details(run_id: str) -> Optional[Dict[str, Any]]:
    if supabase_client:
        try:
            res = supabase_client.table("generations").select("*, test_runs(*, prompt_configs(*)), verification_results(*), regenerations(*)").eq("id", run_id).limit(1).execute()
            if res.data and len(res.data) > 0:
                g = res.data[0]
                tr = g.get("test_runs") or {}
                pc = tr.get("prompt_configs", [{}])[0] if isinstance(tr.get("prompt_configs"), list) and len(tr.get("prompt_configs")) > 0 else {}
                return {
                    "generation": g,
                    "test_run": tr,
                    "prompt_config": pc,
                    "verification_results": g.get("verification_results", []),
                    "regenerations": g.get("regenerations", [])
                }
        except Exception as e:
            print(f"Supabase run detail query error: {e}")

    gen = next((g for g in _in_memory_db["generations"] if g["id"] == run_id), None)
    if not gen:
        return None
    tr = next((t for t in _in_memory_db["test_runs"] if t["id"] == gen["test_run_id"]), {})
    pc = next((p for p in _in_memory_db["prompt_configs"] if p["test_run_id"] == tr.get("id")), {})
    vrs = [v for v in _in_memory_db["verification_results"] if v["generation_id"] == run_id]
    regs = [r for r in _in_memory_db["regenerations"] if r["generation_id"] == run_id]
    return {
        "generation": gen,
        "test_run": tr,
        "prompt_config": pc,
        "verification_results": vrs,
        "regenerations": regs
    }

def get_comparison_runs(test_run_id: str) -> List[Dict[str, Any]]:
    runs = []
    if supabase_client:
        try:
            res = supabase_client.table("generations").select("*, test_runs(*, prompt_configs(*)), verification_results(*), regenerations(*)").eq("test_run_id", test_run_id).execute()
            if res.data:
                for g in res.data:
                    if g.get("status") in ["Verified", "Regenerated", "Pass", "PASS"] and "error" not in g.get("output_json", {}):
                        tr = g.get("test_runs") or {}
                        pc = tr.get("prompt_configs", [{}])[0] if isinstance(tr.get("prompt_configs"), list) and len(tr.get("prompt_configs")) > 0 else {}
                        runs.append({
                            "generation": g,
                            "test_run": tr,
                            "prompt_config": pc,
                            "verification_results": g.get("verification_results", []),
                            "regenerations": g.get("regenerations", [])
                        })
                return runs
        except Exception as e:
            print(f"Supabase comparison query error: {e}")

    for g in _in_memory_db["generations"]:
        if g.get("test_run_id") == test_run_id or not test_run_id or test_run_id == "default":
            if g.get("status") in ["Verified", "Regenerated", "Pass", "PASS"] and "error" not in g.get("output_json", {}):
                tr = next((t for t in _in_memory_db["test_runs"] if t["id"] == g["test_run_id"]), {})
                pc = next((p for p in _in_memory_db["prompt_configs"] if p["test_run_id"] == g["test_run_id"]), {})
                vrs = [v for v in _in_memory_db["verification_results"] if v["generation_id"] == g["id"]]
                regs = [r for r in _in_memory_db["regenerations"] if r["generation_id"] == g["id"]]
                runs.append({
                    "generation": g,
                    "test_run": tr,
                    "prompt_config": pc,
                    "verification_results": vrs,
                    "regenerations": regs
                })
    return runs
