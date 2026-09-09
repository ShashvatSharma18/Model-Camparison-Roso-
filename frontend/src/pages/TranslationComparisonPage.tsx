import React, { useState, useEffect, useRef } from 'react';
import { fetchHistory, fetchComparisonRuns } from '../services/api';
import type { HistoryRun } from '../types';
import { CustomDropdown } from '../components/CustomDropdown';
import { Globe, FileText, Cpu, Clock, DollarSign, Layers, Copy, GitCompare } from 'lucide-react';

export const TranslationComparisonPage: React.FC = () => {
  const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
  
  const [selectedSourceGenId, setSelectedSourceGenId] = useState<string>('');
  const [selectedTargetLang, setSelectedTargetLang] = useState<string>('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  
  const [sourceRunData, setSourceRunData] = useState<any>(null);
  const [comparedModels, setComparedModels] = useState<any[]>([]);
  const [showHeadings, setShowHeadings] = useState<boolean>(true);

  const desiredOrder = [
    "meta_title", "meta_description", "option_name", "option_description", 
    "snippet_summary", "highlight_bullet", "intro_paragraph", "long_description", 
    "title", "introduction", "attractions", "activities", "best_time_to_visit", 
    "travel_tips", "faqs", "faq", "language"
  ];
  
  const innerObjectOrder = ["name", "title", "question", "description", "answer", "highlights"];

  const renderJsonValue = (title: string, val: any, showHeadings: boolean) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return (
        <div style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
          {showHeadings && <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{title.replace(/_/g, ' ')}</div>}
          <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{val}</div>
        </div>
      );
    }
    
    if (Array.isArray(val)) {
      return (
        <div style={{ marginBottom: '16px' }}>
          {showHeadings && <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{title.replace(/_/g, ' ')}</div>}
          <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#334155', margin: 0 }}>
            {val.map((arrItem: any, j: number) => {
              if (typeof arrItem === 'string') {
                return <li key={j} style={{ marginBottom: '6px' }}>{arrItem}</li>;
              }
              if (typeof arrItem === 'object' && arrItem !== null) {
                const keys = Object.keys(arrItem).sort((a, b) => {
                  const idxA = innerObjectOrder.indexOf(a);
                  const idxB = innerObjectOrder.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b);
                });
                return (
                  <li key={j} style={{ marginBottom: '12px' }}>
                    {keys.map((k) => (
                      <div key={k} style={{ marginBottom: '4px' }}>
                        {showHeadings && <strong style={{ color: '#475569', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}: </strong>}
                        <span>{arrItem[k]}</span>
                      </div>
                    ))}
                  </li>
                );
              }
              return <li key={j} style={{ marginBottom: '6px' }}>{JSON.stringify(arrItem)}</li>;
            })}
          </ul>
        </div>
      );
    }
    
    return (
      <div style={{ marginBottom: '16px' }}>
        {showHeadings && <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{title.replace(/_/g, ' ')}</div>}
        <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>{JSON.stringify(val, null, 2)}</div>
      </div>
    );
  };

  const comparisonSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory()
      .then((data) => {
        setHistoryRuns(data);
      })
      .catch((e) => console.error(e));
  }, []);

  // 1. Get Source Content Options (Generations that have been translated)
  const translationRuns = historyRuns.filter(h => h.task_type === 'Translation');
  const generationRuns = historyRuns.filter(h => (h.task_type || 'Generation') === 'Generation');
  
  // Find unique source generation IDs that have at least one translation
  const translatedSourceIds = Array.from(new Set(translationRuns.map(tr => tr.source_generation_id).filter(Boolean)));
  
  const sourceOptions = generationRuns
    .filter(g => translatedSourceIds.includes(g.run_id))
    .slice(0, 15)
    .map(g => ({
      value: g.run_id,
      label: `${g.city || 'Unknown'} - ${g.model} | ${new Date(g.created_at || '').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
    }));

  // Auto-select first source if available and nothing is selected
  useEffect(() => {
    if (sourceOptions.length > 0 && !selectedSourceGenId) {
      setSelectedSourceGenId(sourceOptions[0].value);
    }
  }, [sourceOptions, selectedSourceGenId]);

  // Fetch Source Data when source changes
  useEffect(() => {
    if (selectedSourceGenId) {
      const sourceInfo = generationRuns.find(g => g.run_id === selectedSourceGenId);
      if (sourceInfo && sourceInfo.test_run_id) {
        fetchComparisonRuns(sourceInfo.test_run_id).then(runs => {
          const runDetails = runs.find((r: any) => (r.generation || r).id === selectedSourceGenId);
          if (runDetails) {
            setSourceRunData(runDetails);
          }
        }).catch(console.error);
      }
    }
  }, [selectedSourceGenId, generationRuns]);

  // 2. Get Target Language Options based on selected source
  const translationsForSelectedSource = translationRuns.filter(tr => tr.source_generation_id === selectedSourceGenId);
  const availableLanguages = Array.from(new Set(translationsForSelectedSource.map(tr => tr.language).filter(Boolean)));
  const languageOptions = availableLanguages.map(lang => ({ value: lang, label: lang }));

  // Auto-select first language
  useEffect(() => {
    if (languageOptions.length > 0 && (!selectedTargetLang || !availableLanguages.includes(selectedTargetLang))) {
      setSelectedTargetLang(languageOptions[0].value);
    } else if (languageOptions.length === 0) {
      setSelectedTargetLang('');
    }
  }, [languageOptions, selectedTargetLang, availableLanguages]);

  // 3. Get Model Options based on selected source and language
  const translationsForSourceAndLang = translationsForSelectedSource.filter(tr => tr.language === selectedTargetLang);
  
  // Group by model, getting the latest verified run for each model
  const latestRunsByModel = new Map<string, any>();
  translationsForSourceAndLang.forEach(tr => {
    const status = (tr.status || '').toLowerCase();
    if (status === 'verified' || status === 'regenerated' || status === 'pass') {
      const existing = latestRunsByModel.get(tr.model_id);
      if (!existing || new Date(tr.created_at || 0) > new Date(existing.created_at || 0)) {
        latestRunsByModel.set(tr.model_id, tr);
      }
    }
  });

  const availableModels = Array.from(latestRunsByModel.values());

  // Fetch actual output data for models when Compare is clicked
  const handleCompareClick = async () => {
    if (selectedModelIds.length === 0 || !selectedTargetLang) return;
    
    // We need to fetch details for each selected translation run.
    // They might belong to different test_run_ids because TranslationPage creates a new test_run per generation.
    const selectedRuns = availableModels.filter(m => selectedModelIds.includes(m.model_id));
    
    try {
      const allFetchedDetails = await Promise.all(selectedRuns.map(async (runInfo) => {
        const testRunData = await fetchComparisonRuns(runInfo.test_run_id);
        return testRunData.find((r: any) => (r.generation || r).id === runInfo.run_id);
      }));
      
      setComparedModels(allFetchedDetails.filter(Boolean));
      
      // Auto scroll
      setTimeout(() => {
        if (comparisonSectionRef.current) {
          comparisonSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (e) {
      console.error("Error fetching translation comparison runs:", e);
      alert("Failed to load translation data for comparison.");
    }
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModelIds(prev => 
      prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]
    );
  };

  return (
    <div className="workspace-container">
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 100%)', borderRadius: '16px', padding: '32px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ background: '#DBEAFE', padding: '16px', borderRadius: '50%', color: '#2563EB' }}>
            <Globe size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#1E3A8A', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Translation Comparison</h2>
            <p style={{ margin: 0, color: '#3B82F6', fontSize: '15px', fontWeight: 500 }}>
              Compare translations of your generated content across different models.<br/>
              Select a content, choose target language and models, and see how each model translates the text.
            </p>
          </div>
        </div>
        <div style={{ backgroundColor: '#F8FAFC', padding: '16px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#E0E7FF', padding: '8px', borderRadius: '8px', color: '#4F46E5' }}>
            <GitCompare size={20} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Simple. Clear. Compare.</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Find the translation that fits your needs.</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* Step 1 */}
          <div style={{ flex: '0 0 300px' }}>
            <label className="form-label" style={{ marginBottom: '12px', display: 'block', fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>1. Select Generated Content</label>
            <CustomDropdown
              options={sourceOptions}
              selectedValue={selectedSourceGenId}
              setSelectedValue={(val) => {
                setSelectedSourceGenId(val);
                setSelectedModelIds([]); // Reset models when source changes
                setComparedModels([]); // Reset the comparison grid when source changes
                setSourceRunData(null);
              }}
              placeholder={sourceOptions.length > 0 ? "Select Source Content" : "No translated content available"}
            />
          </div>

          {/* Step 2 */}
          <div style={{ flex: '0 0 200px' }}>
            <label className="form-label" style={{ marginBottom: '12px', display: 'block', fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>2. Target Language</label>
            <CustomDropdown
              options={languageOptions}
              selectedValue={selectedTargetLang}
              setSelectedValue={(val) => {
                setSelectedTargetLang(val);
                setSelectedModelIds([]); // Reset models when language changes
              }}
              placeholder={languageOptions.length > 0 ? "Select Language" : "No languages"}
            />
          </div>
          
          {/* Step 3 */}
          <div style={{ flex: 1, paddingLeft: '24px', borderLeft: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                3. Select Translation Models
              </label>
              <button
                className="btn-primary"
                onClick={handleCompareClick}
                disabled={selectedModelIds.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: selectedModelIds.length === 0 ? 0.5 : 1,
                  boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)'
                }}
              >
                <GitCompare size={18} /> Compare Translations
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', minHeight: '42px' }}>
              {availableModels.length > 0 ? availableModels.map(m => (
                <label key={m.model_id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                  userSelect: 'none'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedModelIds.includes(m.model_id)}
                    onChange={() => toggleModelSelection(m.model_id)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{m.model}</span>
                </label>
              )) : (
                <div style={{ fontSize: '13px', color: '#94A3B8' }}>Select a content & language first.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Section */}
      {(sourceRunData || comparedModels.length > 0) && (
        <div ref={comparisonSectionRef} style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* Left Panel - Source Content */}
          <div style={{ flex: '0 0 350px' }}>
            <div className="card" style={{ padding: '24px', height: '100%', position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#3B82F6" /> Source Content
                </h3>
                <span className="badge badge-primary">English</span>
              </div>
              
              {sourceRunData && (
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #E2E8F0' }}>
                  {sourceRunData.test_run?.city} — {sourceRunData.generation?.model_name} | {new Date(sourceRunData.generation?.created_at || '').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
              )}

              {sourceRunData && sourceRunData.generation?.output_json ? (
                <div className="formatted-content" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '8px' }}>
                  {Object.keys(sourceRunData.generation.output_json)
                    .filter(k => k !== 'error')
                    .sort((a, b) => {
                      const targetSchema = sourceRunData?.test_run?.input_json?.__target_schema__;
                      if (targetSchema && typeof targetSchema === 'string') {
                        const lowerSchema = targetSchema.toLowerCase();
                        const idxA = lowerSchema.indexOf(a.toLowerCase());
                        const idxB = lowerSchema.indexOf(b.toLowerCase());
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                      }
                      const idxA = desiredOrder.indexOf(a);
                      const idxB = desiredOrder.indexOf(b);
                      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                      if (idxA !== -1) return -1;
                      if (idxB !== -1) return 1;
                      return a.localeCompare(b);
                    })
                    .map((key) => (
                      <div key={key}>
                        {renderJsonValue(key, sourceRunData.generation.output_json[key], showHeadings)}
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', padding: '40px 0' }}>
                  Select source content to view
                </div>
              )}

              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE', display: 'flex', gap: '12px' }}>
                <Globe size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#1E3A8A', lineHeight: '1.5' }}>
                  This is the original content in English, used for translation comparison.
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Grid of Translations */}
          {comparedModels.length > 0 && (
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={20} color="#4F46E5" /> Translation Comparison ({selectedTargetLang})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={showHeadings} 
                      onChange={() => setShowHeadings(!showHeadings)} 
                      style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer', margin: 0 }} 
                    />
                    Show Headings
                  </label>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Copy size={14} /> Copy All
                  </button>
                </div>
              </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {comparedModels.map((item, idx) => {
                const g = item.generation || item;
                const outJson = g.output_json || {};
                return (
                  <div key={idx} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '10px', color: '#2563EB', border: '1px solid #E2E8F0' }}>
                          <Cpu size={20} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                            {g.model_name || g.model_id}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748B' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><DollarSign size={12} /> ${(g.cost || 0).toFixed(4)}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {((g.latency_ms || 0) / 1000).toFixed(1)}s</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> {(g.total_tokens || 0)} tokens</span>
                          </div>
                        </div>
                      </div>
                      <button style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }} title="Copy JSON">
                        <Copy size={16} />
                      </button>
                    </div>

                    <div className="formatted-content" style={{ flex: 1 }}>
                      {Object.keys(outJson)
                        .filter(k => k !== 'error')
                        .sort((a, b) => {
                          const targetSchema = sourceRunData?.test_run?.input_json?.__target_schema__;
                          if (targetSchema && typeof targetSchema === 'string') {
                            const lowerSchema = targetSchema.toLowerCase();
                            const idxA = lowerSchema.indexOf(a.toLowerCase());
                            const idxB = lowerSchema.indexOf(b.toLowerCase());
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                          }
                          const idxA = desiredOrder.indexOf(a);
                          const idxB = desiredOrder.indexOf(b);
                          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                          if (idxA !== -1) return -1;
                          if (idxB !== -1) return 1;
                          return a.localeCompare(b);
                        })
                        .map((key) => (
                          <div key={key}>
                            {renderJsonValue(key, outJson[key], showHeadings)}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};
