import React, { useState, useEffect } from 'react';
import { 
  Copy, Check, Terminal, Play, 
  FileCode, CheckCircle2, RefreshCw, AlertCircle, Eye, Database
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
        padding: '1.5rem 2rem',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderLeft: '4px solid var(--accent-teal)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span className="badge badge-qualified">Google Apps Script Webhook API Ready</span>
            <span className="badge badge-called">X-CRM-API-KEY Authenticated</span>
            <span className="badge badge-meeting">Strict Upsert Deduplication</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: 0 }}>
            Google Sheets & Apps Script Inbound Webhook Hub
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Receive leads from any tab in your Meta Ads Google Spreadsheets directly into SQLite database with full activity separation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button 
            onClick={handleExecuteTest}
            disabled={isSendingTest}
            className="btn-teal"
            style={{ fontSize: '0.85rem' }}
          >
            <Play size={16} /> {isSendingTest ? 'Sending Webhook Test...' : 'Send Test Lead Webhook'}
          </button>
        </div>
      </div>

      {/* Test Feedback Notice */}
      {testResult && (
        <div style={{
          background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: testResult.success ? '1px solid #10b981' : '1px solid #ef4444',
          color: testResult.success ? '#34d399' : '#f87171',
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
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                Action: <code>{testResult.action || 'N/A'}</code> | Lead ID: <code>{testResult.lead_id || 'N/A'}</code> | Message: {testResult.message}
              </div>
            </div>
          </div>
          <button onClick={() => setTestResult(null)} style={{ background: 'transparent', color: 'inherit', fontSize: '0.8rem' }}>Dismiss</button>
        </div>
      )}

      {/* Key Credentials Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Webhook POST URL</span>
            <button onClick={handleCopyUrl} style={{ background: 'transparent', color: 'var(--accent-teal)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              {copiedUrl ? <Check size={12} /> : <Copy size={12} />} {copiedUrl ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff', wordBreak: 'break-all' }}>
            {webhookUrl}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Authentication Header (X-CRM-API-KEY)</span>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Protected in .env</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff', letterSpacing: '2px' }}>
            ••••••••••••••••••••••••••••••••
          </div>
        </div>
      </div>

      {/* Sub-tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveSubTab('script')}
          className={activeSubTab === 'script' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.825rem' }}
        >
          <FileCode size={15} /> Google Apps Script Code
        </button>
        <button
          onClick={() => { setActiveSubTab('logs'); loadLogs(); }}
          className={activeSubTab === 'logs' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.825rem' }}
        >
          <Database size={15} /> Inbound Webhook Logs ({logs.length})
        </button>
        <button
          onClick={() => setActiveSubTab('curl')}
          className={activeSubTab === 'curl' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: '0.825rem' }}
        >
          <Terminal size={15} /> cURL / HTTP Spec
        </button>
      </div>

      {/* SUBTAB 1: Google Apps Script Code */}
      {activeSubTab === 'script' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileCode size={18} color="var(--accent-teal)" /> Ready-to-Paste Google Apps Script
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Open Google Sheets &rarr; <strong>Extensions &rarr; Apps Script</strong> &rarr; Replace default code &rarr; Click <strong>Save</strong>.
              </p>
            </div>

            <button onClick={handleCopyScript} className="btn-primary" style={{ fontSize: '0.825rem' }}>
              {copiedScript ? <Check size={14} /> : <Copy size={14} />} {copiedScript ? 'Copied to Clipboard!' : 'Copy Script Code'}
            </button>
          </div>

          <pre style={{
            background: '#070a10',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: '#94a3b8',
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
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Live Inbound Webhook Request Logs</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Real-time record of all HTTP POST requests received by the CRM webhook endpoint.
              </p>
            </div>
            <button onClick={loadLogs} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
              <RefreshCw size={14} style={{ animation: isLoadingLogs ? 'spin 1s linear infinite' : 'none' }} /> Refresh Logs
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
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.received_at).toLocaleTimeString()} {new Date(log.received_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <span className={`badge ${log.status === 'success' ? 'badge-qualified' : 'badge-unqualified'}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem', color: log.action === 'created' ? '#34d399' : '#38bdf8', fontWeight: 600 }}>
                        {log.action || 'N/A'}
                      </td>
                      <td style={{ padding: '0.6rem', fontFamily: 'monospace', color: '#fff' }}>
                        {log.crm_lead_id || 'None'}
                      </td>
                      <td style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>
                        {log.source_sheet || 'Default'}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="btn-secondary" 
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <Eye size={12} /> Inspect Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: cURL Command */}
      {activeSubTab === 'curl' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>cURL Terminal Execution Command</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Test the webhook directly from your command prompt, PowerShell, or postman.
              </p>
            </div>
            <button onClick={handleCopyCurl} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
              {copiedCurl ? <Check size={14} /> : <Copy size={14} />} {copiedCurl ? 'Copied cURL' : 'Copy cURL'}
            </button>
          </div>

          <pre style={{
            background: '#070a10',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: 'var(--accent-solar)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace'
          }}>
            {curlCmd}
          </pre>
        </div>
      )}

      {/* Inspect Log Payload Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 15, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Webhook Payload Details</h3>
              <button onClick={() => setSelectedLog(null)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>Close</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              <div><strong>Status:</strong> {selectedLog.status}</div>
              <div><strong>Action:</strong> {selectedLog.action}</div>
              <div><strong>Message:</strong> {selectedLog.response_message}</div>
              <div><strong>Timestamp:</strong> {new Date(selectedLog.received_at).toLocaleString()}</div>
            </div>

            <pre style={{
              background: '#070a10',
              border: '1px solid var(--border-color)',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: '#34d399',
              overflowX: 'auto',
              fontFamily: 'monospace'
            }}>
              {JSON.stringify(selectedLog.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
};
