import { CustomDropdown } from "../components/CustomDropdown";
import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings, fetchModels } from '../services/api';
import type { ModelInfo, AppSettings } from '../types';
import { Save, CheckCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchModels()])
      .then(([sData, mData]) => {
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.verify_additional_instructions}
              onChange={(e) => setSettings({ ...settings, verify_additional_instructions: e.target.checked })}
            />
            Verify Additional Instructions (LLM)
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Verification & Regeneration Tuning</div>


        <div className="form-group">
          <label className="form-label">Regeneration Strategy</label>
          <CustomDropdown
            options={[
              { value: 'update_failed_sections', label: 'Update Only Failed Sections (Field-Grouped)' },
              { value: 'full_rebuild', label: 'Full Content Rebuild' }
            ]}
            selectedValue={settings.regeneration_strategy}
            setSelectedValue={(v) => setSettings({ ...settings, regeneration_strategy: v })}
            placeholder="Select Strategy"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Field Matching Strictness</label>
          <CustomDropdown
            options={[
              { value: 'strict', label: 'Strict' },
              { value: 'medium', label: 'Medium' },
              { value: 'relaxed', label: 'Relaxed' }
            ]}
            selectedValue={settings.field_matching_strictness}
            setSelectedValue={(v) => setSettings({ ...settings, field_matching_strictness: v })}
            placeholder="Select Strictness"
            direction="up"
          />
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
    </div>
  );
};
