import React, { useState, useEffect } from 'react';
import { 
  Copy, Check, Terminal, Play, 
  FileCode, CheckCircle2, RefreshCw, AlertCircle, Eye, Database, Zap
} from 'lucide-react';
import { getGoogleAppsScriptCode, generateCurlCommand, CRM_DEFAULT_API_KEY, CRM_DEFAULT_WEBHOOK_URL } from '../services/webhookDocs';
import { fetchWebhookLogs, sendTestWebhook, getSettings } from '../services/leadStorage';

export const WebhookHub = ({ onRefreshLeads }) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('script'); // 'script' | 'logs' | 'curl'

  const settings = getSettings();
  const apiKey = settings.apiKey || CRM_DEFAULT_API_KEY;
  const webhookUrl = settings.webhookUrl || CRM_DEFAULT_WEBHOOK_URL;

  const gasCode = getGoogleAppsScriptCode(webhookUrl, apiKey);
  const curlCmd = generateCurlCommand(webhookUrl, apiKey);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    const fetched = await fetchWebhookLogs();
    setLogs(fetched);
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(gasCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCmd);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleExecuteTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    const result = await sendTestWebhook();
    setIsSendingTest(false);
    setTestResult(result);
    onRefreshLeads();
    loadLogs();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem',
        borderRadius: 'var(--radius-md)',
        background: '#ffffff',
        borderLeft: '4px solid var(--accent-solar)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="badge badge-called">Google Apps Script Tool Active</span>
            <span className="badge badge-not-called">X-CRM-API-KEY Protected</span>
            <span className="badge badge-meeting">Automated Ingestion</span>
          </div>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--text-main)', margin: 0, fontWeight: 800 }}>
            Google Sheets & Apps Script Inbound Webhook Hub
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Incoming leads from your Meta Ads Google Spreadsheets are streamed directly into the CRM database in real time.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button 
            onClick={handleExecuteTest}
            disabled={isSendingTest}
            className="btn-primary"
            style={{ fontSize: '0.825rem' }}
          >
            <Play size={15} /> {isSendingTest ? 'Sending Test...' : 'Send Test Webhook Lead'}
          </button>
        </div>
      </div>

      {/* Test Feedback Notice */}
      {testResult && (
        <div style={{
          background: testResult.success ? '#ecfdf5' : '#fef2f2',
          border: testResult.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
          color: testResult.success ? '#059669' : '#b91c1c',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {testResult.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <div>
              <strong>{testResult.success ? 'Webhook Ingestion Successful!' : 'Webhook Ingestion Failed'}</strong>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>
                Action: <code>{testResult.action || 'N/A'}</code> | Lead ID: <code>{testResult.lead_id || 'N/A'}</code> | Message: {testResult.message}
              </div>
            </div>
          </div>
          <button onClick={() => setTestResult(null)} style={{ background: 'transparent', color: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {/* Key Credentials Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Webhook Endpoint URL</span>
            <button onClick={handleCopyUrl} style={{ background: 'transparent', color: 'var(--accent-solar)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', fontWeight: 600 }}>
              {copiedUrl ? <Check size={13} color="#059669" /> : <Copy size={13} />} {copiedUrl ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-main)', wordBreak: 'break-all', fontWeight: 600 }}>
            {webhookUrl}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>API Key Header (X-CRM-API-KEY)</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>✓ Server Authenticated</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-main)', letterSpacing: '2px' }}>
            ••••••••••••••••••••••••••••••••
          </div>
        </div>
      </div>

      {/* Sub-tab Switcher Pills */}
      <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: 'var(--radius-pill)', width: 'fit-content', gap: '3px' }}>
        <button
          onClick={() => setActiveSubTab('script')}
          style={{
            padding: '0.45rem 0.95rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: activeSubTab === 'script' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'script' ? 'var(--text-main)' : 'var(--text-muted)',
            boxShadow: activeSubTab === 'script' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer'
          }}
        >
          <FileCode size={15} /> Apps Script Code
        </button>
        <button
          onClick={() => { setActiveSubTab('logs'); loadLogs(); }}
          style={{
            padding: '0.45rem 0.95rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: activeSubTab === 'logs' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'logs' ? 'var(--text-main)' : 'var(--text-muted)',
            boxShadow: activeSubTab === 'logs' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer'
          }}
        >
          <Database size={15} /> Webhook Request Logs ({logs.length})
        </button>
        <button
          onClick={() => setActiveSubTab('curl')}
          style={{
            padding: '0.45rem 0.95rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: activeSubTab === 'curl' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'curl' ? 'var(--text-main)' : 'var(--text-muted)',
            boxShadow: activeSubTab === 'curl' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer'
          }}
        >
          <Terminal size={15} /> cURL Spec
        </button>
      </div>

      {/* SUBTAB 1: Google Apps Script Code */}
      {activeSubTab === 'script' && (
        <div className="glass-panel" style={{ padding: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <FileCode size={18} color="var(--accent-solar)" /> Google Apps Script Webhook Push Code
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                In Google Sheets &rarr; <strong>Extensions &rarr; Apps Script</strong> &rarr; Paste & Save.
              </p>
            </div>

            <button onClick={handleCopyScript} className="btn-primary" style={{ fontSize: '0.8rem' }}>
              {copiedScript ? <Check size={14} /> : <Copy size={14} />} {copiedScript ? 'Copied!' : 'Copy Script'}
            </button>
          </div>

          <pre style={{
            background: '#0f172a',
            border: '1px solid #334155',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: '#cbd5e1',
            maxHeight: '400px',
            overflowY: 'auto',
            whiteSpace: 'pre',
            fontFamily: 'monospace'
          }}>
            {gasCode}
          </pre>
        </div>
      )}

      {/* SUBTAB 2: Inbound Webhook Logs */}
      {activeSubTab === 'logs' && (
        <div className="glass-panel" style={{ padding: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>Live Inbound Request Logs</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Audit log of all HTTP POST webhook deliveries received by the CRM backend.
              </p>
            </div>
            <button onClick={loadLogs} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
              <RefreshCw size={14} style={{ animation: isLoadingLogs ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Database size={36} color="var(--text-dim)" style={{ marginBottom: '0.5rem' }} />
              <p>No webhook requests recorded yet.</p>
              <button onClick={handleExecuteTest} className="btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                <Play size={14} /> Send First Test Webhook
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem' }}>Timestamp</th>
                    <th style={{ padding: '0.6rem' }}>Status</th>
                    <th style={{ padding: '0.6rem' }}>Action</th>
                    <th style={{ padding: '0.6rem' }}>External ID</th>
                    <th style={{ padding: '0.6rem' }}>Source Tab</th>
                    <th style={{ padding: '0.6rem' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 10).map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at || log.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <span className={log.status === 'success' ? 'badge badge-called' : 'badge badge-unqualified'}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {log.action || 'upsert'}
                      </td>
                      <td style={{ padding: '0.6rem', fontFamily: 'monospace', color: 'var(--accent-solar)' }}>
                        {log.crm_lead_id || log.lead_id || 'N/A'}
                      </td>
                      <td style={{ padding: '0.6rem', color: 'var(--text-main)' }}>
                        {log.source_sheet || 'Sheet 1'}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                        >
                          <Eye size={12} /> View Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedLog && (
            <div style={{ marginTop: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Payload Inspection</strong>
                <button onClick={() => setSelectedLog(null)} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>Close</button>
              </div>
              <pre style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-main)', background: '#ffffff', padding: '0.75rem', borderRadius: '4px', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
                {JSON.stringify(selectedLog.payload || selectedLog, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: cURL Spec */}
      {activeSubTab === 'curl' && (
        <div className="glass-panel" style={{ padding: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>cURL / HTTP Integration Spec</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>Test via terminal or automation tools</p>
            </div>
            <button onClick={handleCopyCurl} className="btn-primary" style={{ fontSize: '0.8rem' }}>
              {copiedCurl ? <Check size={14} /> : <Copy size={14} />} {copiedCurl ? 'Copied!' : 'Copy cURL'}
            </button>
          </div>

          <pre style={{
            background: '#0f172a',
            border: '1px solid #334155',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: '#cbd5e1',
            overflowX: 'auto',
            whiteSpace: 'pre',
            fontFamily: 'monospace'
          }}>
            {curlCmd}
          </pre>
        </div>
      )}

    </div>
  );
};

export default WebhookHub;
