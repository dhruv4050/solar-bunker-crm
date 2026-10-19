import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Solar Bunker CRM] Uncaught React Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    try {
      localStorage.removeItem('solar_bunker_crm_leads');
      localStorage.removeItem('solar_bunker_active_profile');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Error clearing storage:', e);
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
          padding: '1.5rem',
          fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#fef2f2',
              color: '#ef4444',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 0.5rem 0'
            }}>
              Solar Bunker CRM Interface Issue
            </h2>

            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              lineHeight: 1.5,
              margin: '0 0 1.25rem 0'
            }}>
              The application encountered an unexpected display error while rendering.
            </p>

            {this.state.error && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.75rem',
                color: '#475569',
                fontFamily: 'monospace',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '1.5rem',
                maxHeight: '100px'
              }}>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: 'none',
                  background: '#f59e0b',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={15} /> Reload
              </button>

              <button
                onClick={this.handleClearAndReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={15} /> Reset & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
