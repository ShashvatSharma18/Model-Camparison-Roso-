import { CustomDropdown } from "../components/CustomDropdown";
import React, { useState, useEffect } from 'react';
import { fetchHistory, fetchComparisonRuns } from '../services/api';
import type { HistoryRun } from '../types';
import { Check, Code, FileText, Eye, Layers, Clock, Cpu, DollarSign } from 'lucide-react';
import { RunDetailDrawer } from '../components/RunDetailDrawer';

export const ModelComparisonPage: React.FC = () => {
  const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
  const [selectedTestRunId, setSelectedTestRunId] = useState<string>('');
  const [allComparisonRuns, setAllComparisonRuns] = useState<any[]>([]);

  // Checkbox selections for models (starts empty by default as requested!)
  const [selectedGenIds, setSelectedGenIds] = useState<string[]>([]);
  const [comparedModels, setComparedModels] = useState<any[]>([]);
  const [activeDrawerRunId, setActiveDrawerRunId] = useState<string | null>(null);

  // Per-card view mode: 'formatted' or 'json'
  const [cardViewModes, setCardViewModes] = useState<{ [key: string]: 'formatted' | 'json' }>({});
  const [headingStates, setHeadingStates] = useState<{ [key: string]: boolean }>({});

  const toggleHeadingState = (cardId: string) => {
    setHeadingStates(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  useEffect(() => {
    fetchHistory()
      .then((data) => {
        setHistoryRuns(data);
        if (data.length > 0) {
          const firstLang = data[0].language || 'English';
          const idsForLang = data.filter((r: any) => (r.language || 'English') === firstLang).map((r: any) => r.test_run_id);
          const uniqueIds = Array.from(new Set(idsForLang));
          setSelectedTestRunId(uniqueIds.join(','));
        }
      })
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    if (selectedTestRunId) {
      fetchComparisonRuns(selectedTestRunId)
        .then((data) => {
          // Filter out any Failed, Unverified, or error generations!
          const validRuns = data.filter((item: any) => {
            const g = item.generation || item;
            const status = (g.status || '').toLowerCase();
            const out = g.output_json || {};
            return (status === 'verified' || status === 'regenerated' || status === 'pass') && !out.error;
          });
          setAllComparisonRuns(validRuns);
          setSelectedGenIds([]);
          setComparedModels([]);
        })
        .catch((e) => console.error(e));
    }
  }, [selectedTestRunId]);

  const toggleModelSelection = (genId: string) => {
    if (selectedGenIds.includes(genId)) {
      setSelectedGenIds(selectedGenIds.filter((id) => id !== genId));
    } else {
      setSelectedGenIds([...selectedGenIds, genId]);
    }
  };

  const handleCompareClick = () => {
    const selected = allComparisonRuns.filter((item) => {
      const g = item.generation || item;
      return selectedGenIds.includes(g.id);
    });
    setComparedModels(selected);
  };

  const toggleViewMode = (cardId: string, mode: 'formatted' | 'json') => {
    setCardViewModes((prev) => ({ ...prev, [cardId]: mode }));
  };

  // Color tint schemes for headers matching reference screenshot
  const cardTints = [
    { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6', btnColor: '#6D28D9' }, // Purple tint
    { bg: '#F0FDFA', border: '#CCFBF1', text: '#115E59', btnColor: '#0D9488' }, // Teal tint
    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', btnColor: '#2563EB' }  // Blue tint
  ];

  return (
    <div className="workspace-container">
      {/* 1. Header & Test Run Selection Card */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              Model Comparison
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>
              Select generated models from the boxes below and click "Compare Selected Models" to view side-by-side structured outputs
            </p>
          </div>
          <div style={{ width: '260px' }}>
            <label className="form-label" style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>Select Language</label>
            <CustomDropdown
              options={(() => {
                const languageGroups: Record<string, string[]> = {};
                historyRuns.forEach(r => {
                  const lang = r.language || 'English';
                  if (!languageGroups[lang]) languageGroups[lang] = [];
                  if (!languageGroups[lang].includes(r.test_run_id)) {
                    languageGroups[lang].push(r.test_run_id);
                  }
                });
                const opts = Object.entries(languageGroups).map(([lang, ids]) => ({
                  value: ids.join(','),
                  label: lang
                }));
                if (opts.length === 0) opts.push({ value: 'default', label: 'English' });
                return opts;
              })()}
              selectedValue={selectedTestRunId}
              setSelectedValue={setSelectedTestRunId}
              placeholder="Select Language"
            />
          </div>
        </div>

        {/* 2. Select Models Section with Proper Boxes matching user request */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#2563EB" /> Select Generated Models to Compare ({selectedGenIds.length} selected)
            </span>
            <button
              className="btn-primary"
              onClick={handleCompareClick}
              disabled={selectedGenIds.length === 0}
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 700
              }}
            >
              <Check size={16} /> Compare Selected Models ({selectedGenIds.length})
            </button>
          </div>

          {/* Proper Card Boxes Grid for Valid Models */}
          {allComparisonRuns.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {allComparisonRuns.map((item, idx) => {
                const gen = item.generation || item;
                const isChecked = selectedGenIds.includes(gen.id);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleModelSelection(gen.id)}
                    style={{
                      backgroundColor: isChecked ? '#F5F3FF' : '#FFFFFF',
                      border: '2px solid',
                      borderColor: isChecked ? '#6366F1' : '#E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isChecked ? '0 4px 14px rgba(99, 102, 241, 0.15)' : 'var(--shadow-sm)',
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
                          checked={isChecked}
                          onChange={() => {}} // Click handled by box container
                          style={{ width: '18px', height: '18px', accentColor: '#6366F1', cursor: 'pointer' }}
                        />
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                            🤖 {gen.model_name || gen.model_id}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Attempt #{gen.attempt_number || 1}</span>
                        </div>
                      </div>

                      <span className={`badge badge-${(gen.status || 'Verified').toLowerCase()}`}>
                        {gen.status || 'Verified'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} color="#8B5CF6" /> {((gen.latency_ms || 14500) / 1000).toFixed(1)}s
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={12} color="#0284C7" /> {gen.total_tokens || 4200}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={12} color="#10B981" /> ${(gen.cost || 0).toFixed(4)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '13px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
              No verified model runs found for this test run yet. Generate content first to compare models!
            </div>
          )}
        </div>
      </div>

      {/* 3. Side-by-Side Structured Output Display (Only shown when models are selected and compare clicked!) */}
      {comparedModels.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Side-by-Side Comparison</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(340px, 1fr))`, gap: '20px' }}>
            {comparedModels.map((item, idx) => {
            const gen = item.generation || item;
            const cardId = gen.id || `gen-${idx}`;
            const tint = cardTints[idx % cardTints.length];
            const outJson = gen.output_json || {};
            const viewMode = cardViewModes[cardId] || 'formatted';

            return (
              <div
                key={idx}
                className="card"
                style={{
                  border: `1px solid ${tint.border}`,
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  padding: 0,
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                {/* Tinted Card Header */}
                <div style={{ backgroundColor: tint.bg, padding: '16px 20px', borderBottom: `1px solid ${tint.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: tint.text, margin: 0 }}>
                      🤖 {gen.model_name || gen.model_id}
                    </h3>
                    <span className={`badge badge-${(gen.status || 'Verified').toLowerCase()}`}>
                      {gen.status || 'Verified'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: tint.text, opacity: 0.8, marginBottom: '16px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Latency">
                      <Clock size={14} /> {((gen.latency_ms || 14500) / 1000).toFixed(1)}s
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Tokens">
                      <Cpu size={14} /> {gen.total_tokens || 4200}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Cost">
                      <DollarSign size={14} /> ${(gen.cost || 0).toFixed(4)}
                    </span>
                  </div>

                  {/* Mode Switcher Buttons */}
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => toggleViewMode(cardId, 'formatted')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: viewMode === 'formatted' ? tint.btnColor : '#CBD5E1',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: viewMode === 'formatted' ? '#FFFFFF' : 'transparent',
                        color: viewMode === 'formatted' ? tint.btnColor : '#64748B',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FileText size={12} /> Formatted Structure
                    </button>
                    <button
                      onClick={() => toggleViewMode(cardId, 'json')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: viewMode === 'json' ? tint.btnColor : '#CBD5E1',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: viewMode === 'json' ? '#FFFFFF' : 'transparent',
                        color: viewMode === 'json' ? tint.btnColor : '#64748B',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Code size={12} /> Output JSON
                      </button>
                    </div>
                    {viewMode === 'formatted' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer', fontWeight: 800 }}>
                        <input 
                          type="checkbox" 
                          checked={!!headingStates[cardId]} 
                          onChange={() => toggleHeadingState(cardId)} 
                          style={{ width: '14px', height: '14px', accentColor: tint.btnColor, cursor: 'pointer', margin: 0 }} 
                        />
                        Show Headings
                      </label>
                    )}
                  </div>
                </div>

                {/* Structured Body Content Area */}
                <div style={{ padding: '18px 20px', flex: 1, fontSize: '13px', color: '#334155', height: '380px', overflowY: 'auto' }}>
                  {viewMode === 'formatted' ? (
                    <div>
                      {(() => {
                        let orderedKeys = Object.keys(outJson);
                        try {
                          const schemaStr = item.prompt_config?.target_schema;
                          if (schemaStr) {
                            try {
                              const parsedSchema = JSON.parse(schemaStr);
                              const schemaKeys = Object.keys(parsedSchema);
                              const extraKeys = orderedKeys.filter(k => !schemaKeys.includes(k));
                              orderedKeys = [...schemaKeys.filter(k => orderedKeys.includes(k)), ...extraKeys];
                            } catch (e) {
                              // Not a valid JSON, sort by index of appearance in the string
                              const lowerSchema = schemaStr.toLowerCase();
                              orderedKeys.sort((a, b) => {
                                const idxA = lowerSchema.indexOf(a.toLowerCase());
                                const idxB = lowerSchema.indexOf(b.toLowerCase());
                                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                if (idxA !== -1) return -1;
                                if (idxB !== -1) return 1;
                                return 0;
                              });
                            }
                          }
                        } catch (e) {
                          // Fallback to outJson keys if schema parsing fails
                        }

                        return orderedKeys.map((key, i) => {
                          const val = outJson[key];
                          if (val === undefined || val === null) return null;
                          
                          const title = key.replace(/_/g, ' ').toUpperCase();
                          
                          // Handle simple string/number
                          if (typeof val === 'string' || typeof val === 'number') {
                          return (
                            <div key={i} style={{ marginBottom: '14px' }}>
                              {headingStates[cardId] && <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>{title}</strong>}
                              <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{val}</p>
                            </div>
                          );
                        }

                        // Handle Array
                        if (Array.isArray(val)) {
                           return (
                             <div key={i} style={{ marginBottom: '14px' }}>
                               {headingStates[cardId] && <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>{title}</strong>}
                               <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#334155' }}>
                                 {val.map((arrItem: any, j: number) => {
                                    if (typeof arrItem === 'string') {
                                      return <li key={j} style={{ marginBottom: '4px' }}>{arrItem}</li>;
                                    } else if (arrItem && typeof arrItem === 'object') {
                                      return (
                                        <li key={j} style={{ marginBottom: '6px' }}>
                                          {Object.keys(arrItem).sort((a, b) => {
                                            try {
                                              const schemaStr = item?.prompt_config?.target_schema || item?.test_run?.input_json?.__target_schema__;
                                              if (!schemaStr) return 0;
                                              const lowerSchema = schemaStr.toLowerCase();
                                              const idxA = lowerSchema.indexOf(a.toLowerCase());
                                              const idxB = lowerSchema.indexOf(b.toLowerCase());
                                              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                              if (idxA !== -1) return -1;
                                              if (idxB !== -1) return 1;
                                            } catch(e) {}
                                            return 0;
                                          }).map((k) => (
                                            <div key={k}>
                                              {headingStates[cardId] && <strong>{k.replace(/_/g, ' ').toUpperCase()}: </strong>}
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

                        // Handle Object
                        if (typeof val === 'object') {
                           return (
                             <div key={i} style={{ marginBottom: '14px' }}>
                               {headingStates[cardId] && <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '4px' }}>{title}</strong>}
                               <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                                 {Object.keys(val).sort((a, b) => {
                                   try {
                                     const schemaStr = item.prompt_config?.target_schema || item.test_run?.input_json?.__target_schema__;
                                     if (!schemaStr) return 0;
                                     const lowerSchema = schemaStr.toLowerCase();
                                     const idxA = lowerSchema.indexOf(a.toLowerCase());
                                     const idxB = lowerSchema.indexOf(b.toLowerCase());
                                     if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                     if (idxA !== -1) return -1;
                                     if (idxB !== -1) return 1;
                                   } catch(e) {}
                                   return 0;
                                 }).map((k) => {
                                    const nestedVal = val[k];
                                    return (
                                      <div key={k} style={{ marginBottom: '6px' }}>
                                        {headingStates[cardId] && <strong style={{ fontSize: '12px', color: '#0F172A' }}>{k.replace(/_/g, ' ').toUpperCase()}: </strong>}
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
                        });
                      })()}
                    </div>
                  ) : (
                    <pre style={{ backgroundColor: '#0F172A', color: '#E2E8F0', padding: '12px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(outJson, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Footer Action */}
                <div style={{ padding: '14px 20px', textAlign: 'center', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: tint.btnColor,
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => setActiveDrawerRunId(gen.id)}
                  >
                    <Eye size={14} /> View Full Output Details
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', border: '2px dashed #CBD5E1', backgroundColor: '#F8FAFC' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>No models selected for comparison</p>
          <p style={{ fontSize: '12px', color: '#64748B' }}>Please select 2 or more model boxes above and click <strong>"Compare Selected Models"</strong> to view structured outputs side-by-side.</p>
        </div>
      )}

      {activeDrawerRunId && (
        <RunDetailDrawer runId={activeDrawerRunId} onClose={() => setActiveDrawerRunId(null)} />
      )}
    </div>
  );
};
