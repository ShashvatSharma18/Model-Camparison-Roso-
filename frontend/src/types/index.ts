export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export interface VerificationResult {
  parameter: string;
  status: 'PASS' | 'FAIL';
  reason: string;
  affected_fields: string[];
}

export interface GenerationMetrics {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  latency_sec: number;
  cost: number;
}

export interface GeneratedOutputData {
  title?: string;
  introduction?: string;
  attractions?: Array<{ name?: string; title?: string; description?: string; highlights?: string }>;
  activities?: string[] | Array<{ title?: string; description?: string }>;
  best_time_to_visit?: any;
  travel_tips?: string[];
  faqs?: Array<{ question?: string; answer?: string }>;
  language?: string;
  [key: string]: any;
}

export interface HistoryRun {
  run_id: string;
  test_run_id: string;
  country: string;
  city: string;
  language: string;
  model: string;
  model_id: string;
  status: string;
  attempts?: number;
  attempt_number?: number;
  date?: string;
  created_at?: string;
  latency_ms: number;
  total_tokens: number;
  cost: number;
}

export interface RunDetailsPayload {
  generation: any;
  test_run: any;
  prompt_config: any;
  verification_results: VerificationResult[];
  regenerations: any[];
}

export interface AppSettings {
  verifier_model_id: string;
  verify_tone: boolean;
  verify_audience: boolean;
  verify_content_length: boolean;
  verify_banned_keywords: boolean;
  verify_style_guide: boolean;
  verify_additional_instructions: boolean;
  content_length_tolerance_pct: number;
  max_verification_retries: number;
  regeneration_strategy: string;
  field_matching_strictness: string;
}
