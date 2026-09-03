import React, { useState } from 'react';
import { verifyAuth } from '../services/api';
import { MapPin, Eye, EyeOff, ArrowRight, Info } from 'lucide-react';

interface SecretKeyPageProps {
  onSuccess: (token: string) => void;
}

export const SecretKeyPage: React.FC<SecretKeyPageProps> = ({ onSuccess }) => {
  const [secretKey, setSecretKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) {
      setError('Please enter secret key.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await verifyAuth(secretKey);
      if (res.token) {
        localStorage.setItem('roso_session_token', res.token);
        onSuccess(res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid secret key. Please try key: 9090');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      
      <div className="auth-header-step">
        <div className="auth-step-number">1</div>
        <div className="auth-step-title">Secret Key Authentication</div>
      </div>

      <div className="auth-card">
        
        <div className="auth-logo-container">
          <div className="auth-logo-icon">
            <MapPin size={24} fill="currentColor" />
          </div>
          <div className="auth-logo-text">
            <h1>RosoTravel</h1>
            <p>AI POC</p>
          </div>
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Welcome Back!</h3>
        <p className="auth-subtitle">Please enter your secret key to continue</p>

        <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 2 }}>
          <div className="auth-form-group">
            <label className="auth-label">Secret Key</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="•••••••••••••••••"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                style={{ paddingRight: '40px', letterSpacing: secretKey && !showPassword ? '2px' : 'normal', fontFamily: secretKey && !showPassword ? 'monospace' : 'inherit' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '16px', textAlign: 'left', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Continue'}
          </button>
        </form>

        <div className="auth-alert">
          <div className="auth-alert-title">
            <Info size={16} fill="currentColor" color="white" /> About Secret Key
          </div>
          <div className="auth-alert-desc">You must have a valid secret key to access RosoTravel AI POC application.</div>
        </div>

        <div className="auth-skyline"></div>
      </div>
    </div>
  );
};
