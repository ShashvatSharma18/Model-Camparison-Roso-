import React, { useState, useEffect } from 'react';
import { fetchModels, generateContent, verifyContent, regenerateContent, fetchTestRunUsedModels } from '../services/api';
import type { ModelInfo, VerificationResult } from '../types';
import { VerificationLogsModal } from '../components/VerificationLogsModal';
import { Sparkles, Upload, Trash2, AlertTriangle, CheckCircle, FileText, RefreshCw, Clock, Cpu, DollarSign, Globe, Database, Sliders, Code2, Bot, FileCheck, ShieldCheck, FileX } from 'lucide-react';

const ensureArray = (data: any) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    return Object.entries(data).map(([k, v]) => ({
      name: k, title: k, question: k,
      description: typeof v === 'string' ? v : JSON.stringify(v),
      highlights: typeof v === 'string' ? v : JSON.stringify(v),
      answer: typeof v === 'string' ? v : JSON.stringify(v),
      value: typeof v === 'string' ? v : JSON.stringify(v)
    }));
  }
  return [data];
};

const PREDEFINED_AUDIENCES = [
  'First-Time Visitor',
  'Family Traveler',
  'Couple Traveler',
  'Comfort / Easy-Pace Traveler',
  'Solo / Social Traveler',
  'Interest / Deep-Dive Traveler',
  'Active / Adventure Traveler'
];

const SUGGESTED_TONES = ['Friendly', 'Professional', 'Inspirational', 'Informative', 'Casual'];
const SUGGESTED_KEYWORDS = ['perfect', 'amazing', 'best', 'must-visit'];
const PREDEFINED_LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Russian', 'Polish', 'Swedish', 'Danish', 'Finnish', 'Greek', 'Czech', 'Romanian', 'Hungarian'];

const FULL_OPENROUTER_MODELS: ModelInfo[] = [
  { id: "openai/gpt-4o", name: "GPT-4o (OpenAI)", context_length: 128000, pricing: { prompt: "0.0000025", completion: "0.00001" } },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (OpenAI)", context_length: 128000, pricing: { prompt: "0.00000015", completion: "0.0000006" } },
  { id: "openai/o3-mini", name: "OpenAI o3-mini (OpenAI)", context_length: 200000, pricing: { prompt: "0.0000011", completion: "0.0000044" } },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (Anthropic)", context_length: 200000, pricing: { prompt: "0.000003", completion: "0.000015" } },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku (Anthropic)", context_length: 200000, pricing: { prompt: "0.000001", completion: "0.000005" } },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus (Anthropic)", context_length: 200000, pricing: { prompt: "0.000015", completion: "0.000075" } },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash (Google)", context_length: 1000000, pricing: { prompt: "0.0000001", completion: "0.0000004" } },
  { id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro (Google)", context_length: 2000000, pricing: { prompt: "0.00000125", completion: "0.000005" } },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct (Meta)", context_length: 128000, pricing: { prompt: "0.0000004", completion: "0.0000004" } },
  { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B Instruct (Meta)", context_length: 128000, pricing: { prompt: "0.0000027", completion: "0.0000027" } },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3 (DeepSeek)", context_length: 64000, pricing: { prompt: "0.00000014", completion: "0.00000028" } },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1 Reasoning (DeepSeek)", context_length: 64000, pricing: { prompt: "0.00000055", completion: "0.00000219" } },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct (Qwen)", context_length: 131072, pricing: { prompt: "0.00000035", completion: "0.0000004" } },
  { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B (Qwen)", context_length: 32768, pricing: { prompt: "0.0000002", completion: "0.0000002" } },
  { id: "mistralai/mistral-large-2411", name: "Mistral Large 2 (Mistral AI)", context_length: 128000, pricing: { prompt: "0.000002", completion: "0.000006" } },
  { id: "mistralai/mistral-small-24b-instruct-2501", name: "Mistral Small 24B (Mistral AI)", context_length: 32768, pricing: { prompt: "0.0000001", completion: "0.0000003" } },
  { id: "cohere/command-r-plus", name: "Command R+ (Cohere)", context_length: 128000, pricing: { prompt: "0.0000025", completion: "0.00001" } },
  { id: "perplexity/sonar-reasoning", name: "Sonar Reasoning (Perplexity)", context_length: 127000, pricing: { prompt: "0.000001", completion: "0.000005" } }
];

export const ContentGenerationPage: React.FC = () => {
  // 1. Location
  const [country] = useState('France');
  const [city] = useState('Paris');

  // 2. JSON Test Data
  const [inputJson, setInputJson] = useState<any>(null);
  const [jsonText, setJsonText] = useState('');

  // 3. Language (Default: Blank)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');

  // 4. Prompt Configuration (Default: All Blank)
  const [selectedTone, setSelectedTone] = useState<string>('');
  const [customTone, setCustomTone] = useState('');

  const [selectedAudience, setSelectedAudience] = useState<string>('');

  // Content Length String State (starts blank "", placeholder "e.g. 200")
  const [contentLengthStr, setContentLengthStr] = useState<string>('');

  const [selectedBannedKeywords, setSelectedBannedKeywords] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState('');

  const [styleGuide, setStyleGuide] = useState('');

  // 5. Live Prompt
  const [livePrompt, setLivePrompt] = useState('');
  const [autoBuild, setAutoBuild] = useState(true);

  // 6. Model Selection (Full 18+ OpenRouter Catalog)
  const [models, setModels] = useState<ModelInfo[]>(FULL_OPENROUTER_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Test Run & Model Tracking
  const [activeTestRunId, setActiveTestRunId] = useState<string>('');
  const [usedModelIds, setUsedModelIds] = useState<string[]>([]);

  // Execution States & Metrics
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [executionMetrics, setExecutionMetrics] = useState<any>(null);

  const [generationId, setGenerationId] = useState<string>('');
  const [generationOutput, setGenerationOutput] = useState<any>(null);
  const [outputTab, setOutputTab] = useState<'formatted' | 'json'>('formatted');

  // Verification & Logs
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string>('Unverified');
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [verifierModelId, setVerifierModelId] = useState<string>('openai/gpt-4o');
  const [verificationAttempt, setVerificationAttempt] = useState<number>(1);

  useEffect(() => {
    fetch('/paris.json')
      .then((res) => res.json())
      .then((data) => {
        setInputJson(data);
        setJsonText(JSON.stringify(data, null, 2));
      })
      .catch(() => {
        const fallback = {
          city: "Paris",
          country: "France",
          overview_data: "Paris, the capital of France, is renowned for art, fashion, gastronomy, and culture.",
          attractions: [
            { name: "Eiffel Tower", category: "Landmark", highlights: "Panoramic family views of Paris." },
            { name: "Louvre Museum", category: "Art & Culture", highlights: "Home of the Mona Lisa." }
          ],
          activities: ["Seine River Cruise", "French Pastry Workshop"],
          best_time_to_visit: "Spring (April-May) and Autumn (September-October)",
          travel_information: { currency: "Euro (€)", language: "French" },
          faqs: [{ question: "Is Paris family friendly?", answer: "Yes, Paris offers parks and attractions for all ages." }]
        };
        setInputJson(fallback);
        setJsonText(JSON.stringify(fallback, null, 2));
      });

    fetchModels()
      .then((data) => {
        if (data && data.length > 0) {
          setModels(data);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (activeTestRunId) {
      fetchTestRunUsedModels(activeTestRunId)
        .then((used) => setUsedModelIds(used))
        .catch((e) => console.error(e));
    }
  }, [activeTestRunId]);

  useEffect(() => {
    if (!autoBuild || !inputJson) return;
    const promptParts = [
      `You are a professional travel content writer for RosoTravel.`,
      `Create content for ${city}, ${country} using the provided JSON data:`,
      JSON.stringify(inputJson, null, 2)
    ];

    if (selectedLanguage) {
      promptParts.push(`CRITICAL LANGUAGE MANDATE:\nYou MUST write and translate ALL output text strictly into ${selectedLanguage}. Do NOT write in English.`);
    }
    if (selectedTone) promptParts.push(`Tone: ${selectedTone}`);
    if (selectedAudience) promptParts.push(`Audience Variant: ${selectedAudience}`);
    if (contentLengthStr) promptParts.push(`Character Length: ${contentLengthStr} characters`);
    if (selectedBannedKeywords.length > 0) {
      promptParts.push(`Banned Keywords / Phrases:\n${selectedBannedKeywords.map((kw) => '- ' + kw).join('\n')}`);
    }
    if (styleGuide.trim()) promptParts.push(`Style Guide:\n${styleGuide.trim()}`);

    setLivePrompt(promptParts.join('\n\n'));
  }, [
    autoBuild, city, country, inputJson, selectedLanguage, selectedTone,
    selectedAudience, contentLengthStr, selectedBannedKeywords, styleGuide
  ]);

  const handleAddTone = () => {
    if (customTone.trim()) {
      setSelectedTone(customTone.trim());
      setCustomTone('');
    }
  };

  const handleAddKeyword = () => {
    if (customKeyword.trim() && !selectedBannedKeywords.includes(customKeyword.trim())) {
      setSelectedBannedKeywords([...selectedBannedKeywords, customKeyword.trim()]);
      setCustomKeyword('');
    }
  };

  const toggleBannedKeyword = (kw: string) => {
    if (selectedBannedKeywords.includes(kw)) {
      setSelectedBannedKeywords(selectedBannedKeywords.filter((k) => k !== kw));
    } else {
      setSelectedBannedKeywords([...selectedBannedKeywords, kw]);
    }
  };

  const handleJsonTextChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setInputJson(parsed);
    } catch (e) {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          setInputJson(parsed);
          setJsonText(JSON.stringify(parsed, null, 2));
        } catch (err) {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleGenerate = async () => {
    // Check if the user has provided ANY inputs (JSON data or any prompt configuration)
    const hasData = inputJson !== null && Object.keys(inputJson).length > 0;
    const hasConfig = selectedTone || selectedAudience || contentLengthStr || selectedBannedKeywords.length > 0 || styleGuide.trim();

    if (!hasData && !hasConfig) {
      alert("Please provide some Input Data (JSON) OR select at least one Prompt Configuration before generating content.");
      return;
    }

    if (!selectedModel) {
      alert('Please select an OpenRouter model from the dropdown.');
      return;
    }
    setGenerating(true);
    setGenerationOutput(null);
    setVerificationResults([]);
    setGenerationId('');
    setExecutionMetrics(null);

    try {
      const targetLen = contentLengthStr ? parseInt(contentLengthStr, 10) : null;
      const res = await generateContent({
        country,
        city,
        language: selectedLanguage || 'English',
        input_json: inputJson,
        tone: selectedTone,
        audience: selectedAudience,
        content_length: targetLen,
        banned_keywords: selectedBannedKeywords,
        style_guide: styleGuide,
        final_prompt: livePrompt,
        model_id: selectedModel
      });

      setGenerationId(res.generation_id);
      setActiveTestRunId(res.test_run_id);
      setGenerationOutput(res.output_json);
      setExecutionMetrics(res.metrics || null);
      setUsedModelIds([...usedModelIds, selectedModel]);

      if (res.success) {
        try {
          const verRes = await verifyContent(res.generation_id);
          setVerificationResults(verRes.verification_results || []);
          setGenerationStatus(verRes.status || 'Verified');
          setVerifierModelId(verRes.verifier_model_id || 'openai/gpt-4o');
          setVerificationAttempt(verRes.verification_attempt || 1);
        } catch (verErr) {
          console.error("Auto-verification error:", verErr);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateFailed = async () => {
    if (!generationId) return;
    setRegenerating(true);
    try {
      const res = await regenerateContent(generationId);
      setGenerationOutput(res.output_json);
      setVerificationResults(res.verification_results || []);
      setGenerationStatus(res.status || 'Regenerated');
      setVerificationAttempt(res.attempts || 2);
    } catch (err: any) {
      alert(err.message || 'Regeneration failed.');
    } finally {
      setRegenerating(false);
    }
  };

  const failedParameters = verificationResults.filter((r) => r.status === 'FAIL');

  return (
    <div className="workspace-container">
      <div className="two-column-workspace">
        <div>
          <div className="card">
            <div className="card-header-badge">
              <div className="step-number">1</div>
              <div className="step-title">
                <Globe size={16} color="#2563EB" /> Location & Language Setup
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Country</label>
                <select className="select-input" value={country} disabled>
                  <option value="France">France</option>
                </select>
              </div>
              <div>
                <label className="form-label">City</label>
                <select className="select-input" value={city} disabled>
                  <option value="Paris">Paris</option>
                </select>
              </div>
              <div>
                <label className="form-label">Target Language</label>
                <select className="select-input" value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
                  <option value="">Select Language...</option>
                  {PREDEFINED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header-badge" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="step-number">2</div>
                <div className="step-title">
                  <Database size={16} color="#2563EB" /> JSON Test Data
                </div>
              </div>
              <label className="btn-secondary" style={{ cursor: 'pointer', padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={14} /> Upload JSON
                <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
            <textarea
              className="textarea-input"
              rows={6}
              value={jsonText}
              onChange={(e) => handleJsonTextChange(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', backgroundColor: '#F8FAFC' }}
            />
          </div>

          <div className="card">
            <div className="card-header-badge">
              <div className="step-number">3</div>
              <div className="step-title">
                <Sliders size={16} color="#2563EB" /> Prompt Configuration
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tone (Default: Select Tone)</label>
              <div className="pill-grid">
                {SUGGESTED_TONES.map((t) => (
                  <button
                    key={t}
                    className={`pill-button ${selectedTone === t ? 'selected' : ''}`}
                    onClick={() => setSelectedTone(selectedTone === t ? '' : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="inline-add">
                <input type="text" className="input-text" placeholder="+ Custom Tone" value={customTone} onChange={(e) => setCustomTone(e.target.value)} />
                <button className="btn-secondary" onClick={handleAddTone}>Add</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Audience Variant (Default: Select Audience Variant)</label>
              <div className="pill-grid">
                {PREDEFINED_AUDIENCES.map((aud) => (
                  <button
                    key={aud}
                    className={`pill-button ${selectedAudience === aud ? 'selected' : ''}`}
                    onClick={() => setSelectedAudience(selectedAudience === aud ? '' : aud)}
                  >
                    {aud}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Character Length</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="text"
                  className="input-text"
                  style={{ width: '180px' }}
                  placeholder="e.g. 2000"
                  value={contentLengthStr}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                    setContentLengthStr(cleaned);
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>characters</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Banned Keywords / Phrases (Default: None selected)</label>
              <div className="pill-grid">
                {SUGGESTED_KEYWORDS.map((kw) => {
                  const isSel = selectedBannedKeywords.includes(kw);
                  return (
                    <button key={kw} className={`pill-button ${isSel ? 'selected' : ''}`} onClick={() => toggleBannedKeyword(kw)}>
                      {isSel ? '☑ ' : '☐ '} {kw}
                    </button>
                  );
                })}
                {selectedBannedKeywords.filter((k) => !SUGGESTED_KEYWORDS.includes(k)).map((k) => (
                  <span key={k} className="pill-button selected" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {k} <Trash2 size={12} onClick={() => toggleBannedKeyword(k)} style={{ cursor: 'pointer' }} />
                  </span>
                ))}
              </div>
              <div className="inline-add">
                <input type="text" className="input-text" placeholder="+ Add Custom Keyword" value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)} />
                <button className="btn-secondary" onClick={handleAddKeyword}>Add</button>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Style Guide</label>
              <textarea className="textarea-input" rows={3} placeholder="Write or paste your style guide here..." value={styleGuide} onChange={(e) => setStyleGuide(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="card-header-badge" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="step-number">4</div>
                <div className="step-title">
                  <Code2 size={16} color="#2563EB" /> Live Prompt Compiler
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoBuild} onChange={(e) => setAutoBuild(e.target.checked)} />
                  Auto-build
                </label>
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setLivePrompt('')}>Clear</button>
              </div>
            </div>
            <textarea
              className="textarea-input"
              rows={8}
              value={livePrompt}
              onChange={(e) => setLivePrompt(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', backgroundColor: '#F8FAFC' }}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Execution Panel & Results */}
        <div style={{ position: 'sticky', top: '24px' }}>
          {/* STEP 5: MODEL SELECTION & GENERATE ACTION */}
          <div className="card">
            <div className="card-header-badge">
              <div className="step-number">5</div>
              <div className="step-title">
                <Bot size={16} color="#2563EB" /> Model Execution
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Select OpenRouter Model ({models.length} Models Available)</label>
              <select
                className="select-input"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}
              >
                <option value="">Select a Model...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    🤖 {m.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              onClick={handleGenerate}
              disabled={generating || !selectedModel}
            >
              <Sparkles size={18} />
              <span>{generating ? 'Generating Content & Verifying...' : 'Generate Content'}</span>
            </button>
          </div>

          {/* STEP 6: GENERATED OUTPUT WITH LATENCY METRICS */}
          {generationOutput && (
            <div className="card">
              <div className="card-header-badge" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="step-number">6</div>
                  <div className="step-title">
                    <FileCheck size={16} color="#2563EB" /> Generated Output
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: outputTab === 'formatted' ? '#2563EB' : '#FFFFFF', color: outputTab === 'formatted' ? '#FFFFFF' : '#64748B' }} onClick={() => setOutputTab('formatted')}>Formatted Structure</button>
                  <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: outputTab === 'json' ? '#2563EB' : '#FFFFFF', color: outputTab === 'json' ? '#FFFFFF' : '#64748B' }} onClick={() => setOutputTab('json')}>Output JSON</button>
                </div>
              </div>

              {/* Latency & Performance Metrics Bar */}
              {executionMetrics && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#EFF6FF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #BFDBFE', marginBottom: '14px', fontSize: '12px', color: '#1E40AF', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} color="#2563EB" /> Latency: <strong>{executionMetrics.latency_sec ?? (executionMetrics.latency_ms / 1000).toFixed(2)}s</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Cpu size={14} color="#0284C7" /> Tokens: <strong>{executionMetrics.total_tokens}</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <DollarSign size={14} color="#16A34A" /> Cost: <strong>${executionMetrics.cost?.toFixed(4)}</strong>
                  </span>
                </div>
              )}

              {outputTab === 'formatted' ? (
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', maxHeight: '420px', overflowY: 'auto' }}>
                  {generationOutput.error ? (
                    <div style={{ color: '#DC2626', fontWeight: 600, padding: '16px', backgroundColor: '#FEE2E2', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                      <FileX size={24} style={{ marginBottom: '8px' }} />
                      <p>{generationOutput.error}</p>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: '#0F172A' }}>
                        {generationOutput.title || 'Paris Travel Guide'}
                      </h3>

                      <div style={{ marginBottom: '14px' }}>
                        <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>Introduction</strong>
                        <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                          {generationOutput.introduction}
                        </p>
                      </div>

                  {generationOutput.attractions && (
                    <div style={{ marginBottom: '14px' }}>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>Top Attractions</strong>
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#334155' }}>
                        {ensureArray(generationOutput.attractions).map((a: any, i: number) => (
                          <li key={i} style={{ marginBottom: '4px' }}>
                            <strong>{a.title || a.name}</strong>: {a.description || a.highlights}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {generationOutput.activities && (
                    <div style={{ marginBottom: '14px' }}>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>Recommended Activities</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {ensureArray(generationOutput.activities).map((act: any, i: number) => (
                          <span key={i} style={{ backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>
                            🎯 {typeof act === 'string' ? act : (act.value || act.name || JSON.stringify(act))}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {generationOutput.best_time_to_visit && (
                    <div style={{ marginBottom: '14px' }}>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>Best Time to Visit</strong>
                      <p style={{ fontSize: '12px', color: '#475569' }}>
                        {typeof generationOutput.best_time_to_visit === 'string' ? generationOutput.best_time_to_visit : JSON.stringify(generationOutput.best_time_to_visit)}
                      </p>
                    </div>
                  )}

                  {generationOutput.travel_tips && (
                    <div style={{ marginBottom: '14px' }}>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>Travel Tips</strong>
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#334155' }}>
                        {ensureArray(generationOutput.travel_tips).map((tip: any, i: number) => (
                          <li key={i} style={{ marginBottom: '4px' }}>
                            💡 {typeof tip === 'string' ? tip : (tip.value || tip.name || JSON.stringify(tip))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {generationOutput.faqs && (
                    <div>
                      <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>Frequently Asked Questions</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ensureArray(generationOutput.faqs).map((faq: any, i: number) => (
                          <div key={i} style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                            <strong style={{ fontSize: '12px', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Q: {faq.question}</strong>
                            <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>A: {faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                    </>
                  )}
                </div>
              ) : (
                <pre style={{ backgroundColor: '#0F172A', color: '#E2E8F0', padding: '14px', borderRadius: '8px', fontSize: '12px', maxHeight: '420px', overflowY: 'auto', fontFamily: 'var(--font-mono)' }}>
                  {JSON.stringify(generationOutput, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* STEP 7: DIRECT VERIFICATION RESULTS (Auto-Verified on Generation) */}
          {verificationResults.length > 0 && (
            <div className="card">
              <div className="card-header-badge" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="step-number">7</div>
                  <div className="step-title">
                    <ShieldCheck size={16} color="#2563EB" /> Verification Results
                  </div>
                </div>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setShowLogsModal(true)}>
                  <FileText size={12} /> View Logs
                </button>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className={`badge badge-${generationStatus.toLowerCase()}`}>Status: {generationStatus}</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Attempt #{verificationAttempt}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {verificationResults.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{r.parameter}</span>
                      <span className={`badge badge-${r.status === 'PASS' ? 'verified' : 'failed'}`}>
                        {r.status === 'PASS' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>

                {failedParameters.length > 0 && (
                  <button
                    className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)', width: '100%', padding: '12px' }}
                    onClick={handleRegenerateFailed}
                    disabled={regenerating}
                  >
                    <RefreshCw size={16} />
                    <span>{regenerating ? 'Regenerating Failed Parameters...' : 'Regenerate Failed Parameters'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLogsModal && (
        <VerificationLogsModal
          generationId={generationId}
          verifierModelId={verifierModelId}
          attemptNumber={verificationAttempt}
          results={verificationResults}
          onClose={() => setShowLogsModal(false)}
        />
      )}
    </div>
  );
};
