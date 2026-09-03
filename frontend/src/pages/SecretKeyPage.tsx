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
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-logo-badge">
          <MapPin size={32} />
        </div>
        <h2 className="auth-title">RosoTravel AI POC</h2>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Welcome Back!</h3>
        <p className="auth-subtitle">Please enter your secret key to continue</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label className="form-label">Secret Key</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-text"
                placeholder="Enter secret key..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                style={{ paddingRight: '40px' }}
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
                  cursor: 'pointer'
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
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            disabled={loading}
          >
            <span>{loading ? 'Authenticating...' : 'Continue'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-info-alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
            <Info size={14} /> About Secret Key
          </div>
          <div>You must have a valid secret key to access RosoTravel AI POC application. Default Key: <strong>9090</strong></div>
        </div>
      </div>
    </div>
  );
};
