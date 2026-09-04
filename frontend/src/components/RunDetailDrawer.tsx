import React, { useEffect, useState } from 'react';
import { fetchRunDetails } from '../services/api';
import { X } from 'lucide-react';

interface RunDetailDrawerProps {
  runId: string;
  onClose: () => void;
}

export const RunDetailDrawer: React.FC<RunDetailDrawerProps> = ({ runId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRunDetails(runId)
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '32px', color: '#64748B' }}>Loading Run Details...</div>
        </div>
      </div>
    );
  }

  const gen = data?.generation || {};
  const tr = data?.test_run || {};
  const pc = data?.prompt_config || {};
  const vrs = data?.verification_results || [];

  const getLengthConstraints = (schemaData?: any) => {
    if (!schemaData) return [];
    
    let schemaObj = null;
    let rawStr = "";

    if (typeof schemaData === 'object') {
       schemaObj = schemaData;
       rawStr = JSON.stringify(schemaData);
    } else if (typeof schemaData === 'string') {
       rawStr = schemaData;
       try {
         schemaObj = JSON.parse(schemaData);
       } catch (e) {
         schemaObj = null;
       }
    }

    const constraints: { path: string, constraint: string }[] = [];

    // Approach 1: Traverse JSON Object
    if (schemaObj) {
      const recurse = (obj: any, path: string) => {
        if (typeof obj === 'string') {
          const match = obj.match(/\b(\d+-\d+\s*chars|max\s*\d+\s*chars|min\s*\d+\s*chars|[^)]*character[^)]*)\b/i);
          if (match) {
            constraints.push({ path, constraint: match[0].trim() });
          }
        } else if (Array.isArray(obj)) {
          if (obj.length > 0) recurse(obj[0], path ? `${path} (Item)` : 'Item');
        } else if (typeof obj === 'object' && obj !== null) {
          for (const key of Object.keys(obj)) {
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            recurse(obj[key], path ? `${path} > ${displayKey}` : displayKey);
          }
        }
      };
      recurse(schemaObj, '');
      if (constraints.length > 0) return constraints;
    }

    // Approach 2: Regex on Raw String (fallback for plain text schemas)
    const lines = rawStr.split('\n');
    let currentSection = 'General';
    
    for (let line of lines) {
       line = line.trim();
       if (!line) continue;
       
       const sectionMatch = line.match(/^"?([a-zA-Z0-9_\s]+)"?\s*:/);
       if (sectionMatch) {
         currentSection = sectionMatch[1].trim();
       } else if (line.length > 2 && !line.includes('{') && !line.includes('}') && !line.match(/character|chars/i)) {
         currentSection = line;
       }

       const match = line.match(/\b(\d+-\d+\s*chars|max\s*\d+\s*chars|min\s*\d+\s*chars|[^"'{()]*character[^"'{()]*)\b/i);
       if (match) {
         constraints.push({ path: currentSection, constraint: match[0].trim() });
       }
    }
    
    return constraints;
  };

  const lengthConstraints = getLengthConstraints(pc.target_schema);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Run Details ({runId.substring(0, 8)})</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Test Run ID: {tr.id}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div className="metric-card" style={{ padding: '12px' }}>
            <div className="metric-label">Latency</div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{((gen.latency_ms || 0) / 1000.0).toFixed(2)}s</div>
          </div>
          <div className="metric-card" style={{ padding: '12px' }}>
            <div className="metric-label">Tokens</div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{gen.total_tokens || 0}</div>
          </div>
          <div className="metric-card" style={{ padding: '12px' }}>
            <div className="metric-label">Cost</div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>${(gen.cost || 0).toFixed(4)}</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Prompt Configuration</h4>
          <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
            <div><strong>Location:</strong> {tr.city}, {tr.country}</div>
            <div><strong>Language:</strong> {tr.language}</div>
            <div><strong>Tone:</strong> {pc.tone}</div>
            <div><strong>Audience:</strong> {pc.audience}</div>
            <div><strong>Banned Keywords:</strong> {JSON.stringify(pc.banned_keywords || [])}</div>
            
            {lengthConstraints.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #CBD5E1' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#0F172A' }}>Section Length Constraints:</strong>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {lengthConstraints.map((c, i) => (
                    <li key={i}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>{c.path}:</span> <span style={{ color: '#0284C7', fontWeight: 600 }}>{c.constraint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Verification Breakdown</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {vrs.map((v: any, i: number) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{v.parameter}</td>
                  <td>
                    <span className={`badge badge-${v.status === 'PASS' ? 'verified' : 'failed'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#475569' }}>{v.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Final Output JSON</h4>
          <pre style={{
            backgroundColor: '#0F172A',
            color: '#E2E8F0',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
            fontFamily: 'monospace'
          }}>
            {(() => {
              if (!gen.output_json) return "{}";
              const outJson = gen.output_json;
              let orderedKeys = Object.keys(outJson);
              try {
                const schemaStr = pc.target_schema;
                if (schemaStr) {
                  // If schemaStr is valid JSON, sort by JSON keys
                  try {
                    const parsedSchema = JSON.parse(schemaStr);
                    const schemaKeys = Object.keys(parsedSchema);
                    orderedKeys.sort((a, b) => {
                      const idxA = schemaKeys.indexOf(a);
                      const idxB = schemaKeys.indexOf(b);
                      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                      if (idxA !== -1) return -1;
                      if (idxB !== -1) return 1;
                      return 0;
                    });
                  } catch (e2) {
                    // Not valid JSON, sort by string index
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
                // Ignore fallback to original order
              }
              const sortedJson: any = {};
              orderedKeys.forEach(k => {
                sortedJson[k] = outJson[k];
              });
              return JSON.stringify(sortedJson, null, 2);
            })()}
          </pre>
        </div>
      </div>
    </div>
  );
};
