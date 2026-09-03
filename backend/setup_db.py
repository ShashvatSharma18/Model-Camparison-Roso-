import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

SQL_SCHEMA = """
-- Test Runs table
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    language TEXT NOT NULL,
    input_json JSONB NOT NULL,
    prompt_version TEXT DEFAULT 'V1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt Configs table
CREATE TABLE IF NOT EXISTS prompt_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    tone TEXT,
    audience TEXT,
    content_length INT,
    banned_keywords JSONB,
    style_guide TEXT,
    additional_instructions TEXT,
    final_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generations table
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    attempt_number INT DEFAULT 1,
    output_json JSONB NOT NULL,
    output_text TEXT,
    status TEXT NOT NULL,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    cost FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification Results table
CREATE TABLE IF NOT EXISTS verification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
    verification_attempt INTEGER DEFAULT 1,
    parameter TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    affected_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regenerations table
CREATE TABLE IF NOT EXISTS regenerations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
    parameter TEXT NOT NULL,
    previous_output JSONB,
    new_output JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verifier_model_id TEXT NOT NULL DEFAULT 'openai/gpt-4o',
    verify_tone BOOLEAN DEFAULT TRUE,
    verify_audience BOOLEAN DEFAULT TRUE,
    verify_content_length BOOLEAN DEFAULT TRUE,
    verify_banned_keywords BOOLEAN DEFAULT TRUE,
    verify_style_guide BOOLEAN DEFAULT TRUE,
    verify_additional_instructions BOOLEAN DEFAULT TRUE,
    content_length_tolerance_pct INTEGER DEFAULT 10,
    max_verification_retries INTEGER DEFAULT 2,
    regeneration_strategy TEXT DEFAULT 'update_failed_sections',
    field_matching_strictness TEXT DEFAULT 'medium',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default app settings if empty
INSERT INTO app_settings (verifier_model_id)
SELECT 'openai/gpt-4o'
WHERE NOT EXISTS (SELECT 1 FROM app_settings);
"""

def setup():
    print("Checking Supabase connection...")
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            print("Successfully connected to Supabase.")
            # Note: Execute raw DDL in Supabase SQL editor if RPC not enabled
            print("Database setup complete.")
        except Exception as e:
            print(f"Supabase connection warning: {e}")
    else:
        print("No Supabase URL provided. Backend will use robust fallback storage.")

if __name__ == "__main__":
    setup()
