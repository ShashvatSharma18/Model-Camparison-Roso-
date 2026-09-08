import React, { useState, useEffect, useRef } from 'react';
import { fetchModels, fetchHistory, fetchRunDetails, generateTranslation, fetchSettings } from '../services/api';
import type { ModelInfo, HistoryRun } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { Globe, RefreshCw, AlertTriangle, FileText, Code, Cpu, Clock, Calendar, DollarSign } from 'lucide-react';

export const TranslationPage: React.FC = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [englishRuns, setEnglishRuns] = useState<HistoryRun[]>([]);
  
  const [selectedSourceGenId, setSelectedSourceGenId] = useState<string>('');
  const [selectedTargetLang, setSelectedTargetLang] = useState<string>('German');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  
  const [sourceJson, setSourceJson] = useState<any>(null);
  const [translatedJson, setTranslatedJson] = useState<any>(null);
  const [translationMetrics, setTranslationMetrics] = useState<{latency_ms: number, total_tokens: number, cost: number} | null>(null);
  const [viewMode, setViewMode] = useState<'formatted' | 'json'>('formatted');
  const [showHeadings, setShowHeadings] = useState<boolean>(true);

  const resultsRef = useRef<HTMLDivElement>(null);

  const targetLanguages = ['German', 'Spanish', 'Polish', 'Italian', 'French'];

  useEffect(() => {
    Promise.all([fetchModels(), fetchSettings()])
      .then(([modelsData, settingsData]) => {
        if (modelsData && modelsData.length > 0) {
          const localTransStr = localStorage.getItem('roso_trans_models_v2');
          const DEFAULT_MODELS = [
            "openai/gpt-5.6-sol", "openai/gpt-5.6-terra", "openai/gpt-5.6-luna",
            "anthropic/claude-sonnet-5", "anthropic/claude-sonnet-4.5", "anthropic/claude-haiku-4.5",
            "anthropic/claude-3-haiku", "mistralai/mistral-large", "qwen/qwen3-235b-a22b-2507", "moonshotai/kimi-k2.5"
          ];
          
          let enabledIds = localTransStr ? JSON.parse(localTransStr) : (settingsData?.enabled_translation_models || []);
          if (!enabledIds || enabledIds.length === 0) {
            enabledIds = DEFAULT_MODELS;
          }
          
          const filteredModels = modelsData.filter(m => enabledIds.includes(m.id));
          setModels(filteredModels);
        }
      })
      .catch(console.error);
    fetchHistory().then(history => {
      const validEnglish = history.filter(h => 
        (h.language || 'English').toLowerCase() === 'english' && 
        ((h.status || '').toLowerCase() === 'verified' || (h.status || '').toLowerCase() === 'regenerated')
      );
      setEnglishRuns(validEnglish);
      // We no longer auto-select the first valid english run. User must click.
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedSourceGenId) {
      fetchRunDetails(selectedSourceGenId).then(details => {
        if (details && details.generation && details.generation.output_json) {
          setSourceJson(details.generation.output_json);
          setTranslatedJson(null);
          setTranslationMetrics(null);
        }
      }).catch(console.error);
    } else {
      setSourceJson(null);
      setTranslatedJson(null);
      setTranslationMetrics(null);
    }
  }, [selectedSourceGenId]);

  const handleTranslate = async () => {
    if (!selectedSourceGenId || !selectedTargetLang || !selectedModelId) {
      setTranslationError('Please select a source generation, target language, and a model.');
      return;
    }
    
    setIsTranslating(true);
    setTranslationError('');
    setTranslatedJson(null);
    setTranslationMetrics(null);
    
    try {
      const result = await generateTranslation({
        source_generation_id: selectedSourceGenId,
        target_language: selectedTargetLang,
        model_id: selectedModelId
      });

      if (result && result.output_json) {
        setTranslatedJson(result.output_json);
        if (result.metrics) {
          setTranslationMetrics(result.metrics);
        }
        
        setTimeout(() => {
          if (resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        throw new Error('Failed to generate translation.');
      }
    } catch (e: any) {
      setTranslationError(e.message || 'Failed to translate content.');
    } finally {
      setIsTranslating(false);
    }
  };

  const renderContent = (outJson: any, bg: string, label: string) => {
    if (!outJson) return null;
    return (
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '1px solid #E2E8F0' }}>
        <div style={{ backgroundColor: bg, padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0F172A' }}>{label}</h3>
        </div>
        
        <div style={{ padding: '18px 20px', flex: 1, fontSize: '13px', color: '#334155', height: '500px', overflowY: 'auto' }}>
          {viewMode === 'formatted' ? (
            <div>
              {(() => {
                const desiredOrder = [
                  "meta_title", "meta_description", "option_name", "option_description", 
                  "snippet_summary", "highlight_bullet", "intro_paragraph", "long_description", 
                  "title", "introduction", "attractions", "activities", "best_time_to_visit", 
                  "travel_tips", "faqs", "faq", "language"
                ];
                
                const sortedKeys = Object.keys(outJson).sort((a, b) => {
                  const idxA = desiredOrder.indexOf(a);
                  const idxB = desiredOrder.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b);
                });

                return sortedKeys.map((title, i) => {
                  const val = outJson[title];
                
                if (typeof val === 'string' || typeof val === 'number') {
                  return (
                    <div key={i} style={{ marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                      {showHeadings && <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>{title}</strong>}
                      <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>{val}</p>
                    </div>
                  );
                }
                
                if (Array.isArray(val)) {
                  return (
                    <div key={i} style={{ marginBottom: '14px' }}>
                      {showHeadings && <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>{title}</strong>}
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#334155' }}>
                        {val.map((arrItem: any, j: number) => {
                          if (typeof arrItem === 'string') {
                            return <li key={j} style={{ marginBottom: '6px' }}>{arrItem}</li>;
                          }
                          if (typeof arrItem === 'object') {
                            const innerObjectOrder = ["name", "title", "question", "description", "answer", "highlights"];
                            const keys = Object.keys(arrItem).sort((a, b) => {
                              const idxA = innerObjectOrder.indexOf(a);
                              const idxB = innerObjectOrder.indexOf(b);
                              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                              if (idxA !== -1) return -1;
                              if (idxB !== -1) return 1;
                              return a.localeCompare(b);
                            });
                            return (
                              <li key={j} style={{ marginBottom: '8px' }}>
                                {keys.map((k) => (
                                  <div key={k}>
                                    {showHeadings && <strong>{k.replace(/_/g, ' ').toUpperCase()}: </strong>}
                                    {arrItem[k]}
                                  </div>
                                ))}
                              </li>
                            );
                          }
                          return <li key={j}>{JSON.stringify(arrItem)}</li>;
                        })}
                      </ul>
                    </div>
                  );
                }
                
                if (typeof val === 'object') {
                  return (
                    <div key={i} style={{ marginBottom: '14px' }}>
                      {showHeadings && <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>{title}</strong>}
                      <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                        {Object.keys(val).map((k) => {
                          const nestedVal = val[k];
                          return (
                            <div key={k} style={{ marginBottom: '6px' }}>
                              {showHeadings && <strong style={{ fontSize: '12px', color: '#0F172A' }}>{k.replace(/_/g, ' ').toUpperCase()}: </strong>}
                              <span style={{ fontSize: '12px', color: '#475569', marginLeft: '4px' }}>
                                {typeof nestedVal === 'string' || typeof nestedVal === 'number' 
                                  ? nestedVal 
                                  : JSON.stringify(nestedVal)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                
                return null;
              })})()}
            </div>
          ) : (
            <pre style={{ backgroundColor: '#0F172A', color: '#E2E8F0', padding: '12px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(outJson, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="workspace-container">
      <div className="card" style={{ padding: '24px 28px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={24} color="#6366F1" /> Strict Content Translation
        </h2>
        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px', maxWidth: '800px', lineHeight: '1.5' }}>
          Translate successfully generated English content into designated target languages. 
        </p>

        <div className="two-column-grid" style={{ marginBottom: '24px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>1. Select Source Content (English)</label>
            {englishRuns.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {englishRuns.map(r => {
                  const date = r.created_at ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown Date';
                  const isSelected = selectedSourceGenId === r.run_id;
                  return (
                    <div 
                      key={r.run_id} 
                      onClick={() => setSelectedSourceGenId(prev => prev === r.run_id ? '' : r.run_id)}
                      style={{ 
                        backgroundColor: isSelected ? '#F5F3FF' : '#FFFFFF',
                        border: '2px solid',
                        borderColor: isSelected ? '#6366F1' : '#E2E8F0',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 4px 14px rgba(99, 102, 241, 0.15)' : 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Click handled by box container
                            style={{ width: '18px', height: '18px', accentColor: '#6366F1', cursor: 'pointer' }}
                          />
                          <div>
                            <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {r.city || 'Unknown City'}
                            </h4>
                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>🤖 {r.model || 'Unknown Model'} <span style={{ fontWeight: 400 }}>(Attempt #{r.attempt_number || r.attempts || 1})</span></span>
                          </div>
                        </div>

                        <span className={`badge badge-${(r.status || 'Verified').toLowerCase()}`}>
                          {r.status || 'Verified'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Date">
                          <Calendar size={12} color="#F59E0B" /> {date}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} color="#8B5CF6" /> {((r.latency_ms || 14500) / 1000).toFixed(1)}s
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Cpu size={12} color="#0284C7" /> {r.total_tokens || 4200}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <DollarSign size={12} color="#10B981" /> ${(r.cost || 0).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                No verified or regenerated English content found. Please generate and verify English content first.
              </div>
            )}
          </div>

          {/* Target Language Selection */}
          <div className="form-group">
            <label className="form-label">2. Target Language</label>
            <CustomDropdown
              options={targetLanguages.map(l => ({ value: l, label: l }))}
              selectedValue={selectedTargetLang}
              setSelectedValue={setSelectedTargetLang}
              placeholder="Select target language"
            />
          </div>

          {/* Model Selection */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">3. Translation Model</label>
            <CustomDropdown
              options={models.map(m => ({ value: m.id, label: m.name }))}
              selectedValue={selectedModelId}
              setSelectedValue={setSelectedModelId}
              placeholder="Select AI Model for translation"
            />
          </div>
        </div>

        {translationError && (
          <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> {translationError}
          </div>
        )}

        <button 
          className="btn-primary" 
          onClick={handleTranslate} 
          disabled={isTranslating || !selectedSourceGenId || !selectedModelId}
          style={{ width: '100%', padding: '14px', fontSize: '15px' }}
        >
          {isTranslating ? <><RefreshCw className="spinner" size={18} /> Translating with CMS strict rules...</> : <><Globe size={18} /> Generate Translation</>}
        </button>
      </div>

      {translationMetrics && (
        <div style={{ marginBottom: '24px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} color="#166534" /> Translation Generated Successfully
          </span>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#15803D' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} /> {(translationMetrics.latency_ms / 1000).toFixed(1)}s</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Cpu size={16} /> {translationMetrics.total_tokens} tokens</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={16} /> ${translationMetrics.cost.toFixed(4)}</span>
          </div>
        </div>
      )}

      {sourceJson && (
        <div ref={resultsRef}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Translation Comparison</h3>
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
              {viewMode === 'formatted' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer', fontWeight: 800, marginRight: '12px' }}>
                  <input 
                    type="checkbox" 
                    checked={showHeadings} 
                    onChange={() => setShowHeadings(!showHeadings)} 
                    style={{ width: '14px', height: '14px', accentColor: '#2563EB', cursor: 'pointer', margin: 0 }} 
                  />
                  Show Headings
                </label>
              )}
              <button
                style={viewMode === 'formatted' ? { backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#0F172A', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } : { color: '#64748B', backgroundColor: 'transparent', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={() => setViewMode('formatted')}
              >
                <FileText size={14} /> Formatted Output
              </button>
              <button
                style={viewMode === 'json' ? { backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#0F172A', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } : { color: '#64748B', backgroundColor: 'transparent', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={() => setViewMode('json')}
              >
                <Code size={14} /> JSON Schema
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            {renderContent(sourceJson, '#F8FAFC', 'Source (English)')}
            {translatedJson ? renderContent(translatedJson, '#F0FDFA', `Translated (${selectedTargetLang})`) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #E2E8F0', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#94A3B8', fontSize: '14px', fontWeight: 600 }}>
                Translation will appear here
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
