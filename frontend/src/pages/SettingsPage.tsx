import { CustomDropdown } from "../components/CustomDropdown";
import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings, fetchModels } from '../services/api';
import type { ModelInfo, AppSettings } from '../types';
import { Save, CheckCircle, X, Search } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showModelChooser, setShowModelChooser] = useState(false);
  const [tempGenModels, setTempGenModels] = useState<string[]>([]);
  const [tempTransModels, setTempTransModels] = useState<string[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([fetchSettings(), fetchModels()])
      .then(([sData, mData]) => {
        const localGenStr = localStorage.getItem('roso_gen_models');
        const localTransStr = localStorage.getItem('roso_trans_models');
        if (sData) {
          sData.enabled_generation_models = localGenStr ? JSON.parse(localGenStr) : [];
          sData.enabled_translation_models = localTransStr ? JSON.parse(localTransStr) : [];
        }
        setSettings(sData);
        setModels(mData);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSavedSuccess(false);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div style={{ padding: '32px', color: '#64748B' }}>Loading Settings...</div>;
  }

  return (
    <div className="workspace-container">
      <div style={{ maxWidth: '800px' }}>
      <div className="card">
        <div className="card-title">Dedicated Verifier Model</div>
        <div className="form-group">
          <label className="form-label">Verifier Model (Evaluates Tone, Audience, Style, Instructions consistently)</label>
          <CustomDropdown
            options={models.map(m => ({ value: m.id, label: `${m.name} (${m.id})` }))}
            selectedValue={settings.verifier_model_id}
            setSelectedValue={(v) => setSettings({ ...settings, verifier_model_id: v })}
            placeholder="Select Verifier Model"
          />
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Enabled Models for Generation and Translation
          <button 
            onClick={() => {
              setTempGenModels(settings.enabled_generation_models || []);
              setTempTransModels(settings.enabled_translation_models || []);
              setShowModelChooser(true);
            }}
            style={{ 
              background: '#F8FAFC', 
              border: '1px solid #CBD5E1', 
              padding: '6px 12px', 
              borderRadius: '6px', 
              fontSize: '13px', 
              fontWeight: 600, 
              color: '#334155', 
              cursor: 'pointer' 
            }}
          >
            Choose Models for Generation and Translation
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Active Verification Parameters</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.verify_tone}
              onChange={(e) => setSettings({ ...settings, verify_tone: e.target.checked })}
            />
            Verify Tone (LLM)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.verify_audience}
              onChange={(e) => setSettings({ ...settings, verify_audience: e.target.checked })}
            />
            Verify Audience Variant (LLM)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.verify_per_section_length}
              onChange={(e) => setSettings({ ...settings, verify_per_section_length: e.target.checked })}
            />
            Verify Per-Section Lengths (Code)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.verify_banned_keywords}
              onChange={(e) => setSettings({ ...settings, verify_banned_keywords: e.target.checked })}
            />
            Verify Banned Keywords (Code)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.verify_style_guide}
              onChange={(e) => setSettings({ ...settings, verify_style_guide: e.target.checked })}
            />
            Verify Style Guide (LLM)
          </label>

        </div>
      </div>

      <div className="card">
        <div className="card-title">Verification & Regeneration Tuning</div>

        <div className="form-group">
          <label className="form-label">Regeneration Strategy (Currently Active)</label>
          <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', color: '#475569', fontSize: '14px', fontWeight: 500 }}>
            Update Only Failed Sections (Targeted Regeneration)
          </div>
        </div>
      </div>



      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
        </button>

        {savedSuccess && (
          <span style={{ color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={16} /> Settings saved successfully!
          </span>
        )}
      </div>
      </div>

      {showModelChooser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Select Models for Generation and Translation</h3>
              <button onClick={() => setShowModelChooser(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input 
                  type="text" 
                  placeholder="Search models by name or ID..."
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            
            <div style={{ padding: '0', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#334155' }}>Models</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#334155', width: '140px', textAlign: 'center' }}>Generation</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, color: '#334155', width: '140px', textAlign: 'center' }}>Translation</th>
                  </tr>
                </thead>
                <tbody>
                  {models.filter(m => 
                    m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || 
                    m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
                  ).map(m => {
                    const isGenEnabled = tempGenModels.includes(m.id);
                    const isTransEnabled = tempTransModels.includes(m.id);
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '16px 24px', color: '#0F172A', fontWeight: 500 }}>
                          {m.name} 
                          <span style={{ color: '#64748B', fontSize: '12px', display: 'block', marginTop: '4px' }}>{m.id}</span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isGenEnabled}
                            onChange={(e) => {
                              const updated = e.target.checked ? [...tempGenModels, m.id] : tempGenModels.filter(id => id !== m.id);
                              setTempGenModels(updated);
                            }}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
                          />
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isTransEnabled}
                            onChange={(e) => {
                              const updated = e.target.checked ? [...tempTransModels, m.id] : tempTransModels.filter(id => id !== m.id);
                              setTempTransModels(updated);
                            }}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '20px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#F8FAFC', borderRadius: '0 0 16px 16px' }}>
              <button 
                onClick={() => setShowModelChooser(false)}
                style={{ padding: '10px 16px', background: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  localStorage.setItem('roso_gen_models', JSON.stringify(tempGenModels));
                  localStorage.setItem('roso_trans_models', JSON.stringify(tempTransModels));
                  setSettings({ ...settings, enabled_generation_models: tempGenModels, enabled_translation_models: tempTransModels });
                  setShowModelChooser(false);
                }}
                className="btn-primary"
              >
                Save Models
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
