'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, QrCode, MessageSquare, Clock, AlertCircle, CheckCircle, XCircle, SkipForward, Copy, RotateCcw } from 'lucide-react';

interface BotStatus {
  connected: boolean;
  sessionId: string;
  lastMessageAt: string | null;
  messagesProcessed: number;
  uptimeSeconds: number;
  qrPending: boolean;
  timestamp: string;
}

interface MessageLog {
  id: string;
  group_name: string | null;
  sender: string | null;
  message_type: string | null;
  text_preview: string | null;
  status: 'saved' | 'not_transaction' | 'duplicate' | 'skipped' | 'error';
  skip_reason: string | null;
  amount: number | null;
  transaction_id: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    console.log('[Settings] fetchStatus called, current loading:', loading);
    setLoading(true);
    try {
      const url = '/api/bot-status';
      console.log('[Settings] Fetching:', url);
      const res = await fetch(url, { cache: 'no-store' });
      console.log('[Settings] Response status:', res.status, 'ok:', res.ok);
      if (!res.ok) throw new Error(`Failed to fetch bot status: ${res.status}`);
      const data: BotStatus = await res.json();
      console.log('[Settings] Bot status data:', JSON.stringify(data));
      setStatus(data);
      setError(null);

      // If QR is pending, fetch QR image
      if (data.qrPending) {
        console.log('[Settings] QR pending, fetching QR image...');
        fetchQR();
      } else {
        console.log('[Settings] QR not pending, clearing QR URL');
        setQrUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      console.error('[Settings] fetchStatus error:', msg);
      setError(msg);
      // Clear QR on error too
      setQrUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setLoading(false);
      console.log('[Settings] fetchStatus done, loading set to false');
    }
  }, []);

  const fetchQR = async () => {
    console.log('[Settings] fetchQR called');
    setQrLoading(true);
    try {
      const res = await fetch(`/api/qr?t=${Date.now()}`, { cache: 'no-store' });
      const contentType = res.headers.get('Content-Type');
      console.log('[Settings] QR response status:', res.status, 'content-type:', contentType);
      if (contentType?.includes('image/png')) {
        const blob = await res.blob();
        console.log('[Settings] QR blob size:', blob.size);
        // Revoke old URL to prevent memory leak
        setQrUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } else {
        const body = await res.text();
        console.log('[Settings] QR response (not PNG):', body);
        setQrUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch (err) {
      console.error('[Settings] fetchQR error:', err);
      setQrUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setQrLoading(false);
      console.log('[Settings] fetchQR done');
    }
  };

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/message-logs', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } catch {}
    finally { setLogsLoading(false); }
  }, []);

  const handleReconnect = async () => {
    if (!confirm('This will clear the bot session. After clicking OK, restart the bot service on Railway to generate a new QR code.')) return;
    setReconnecting(true);
    try {
      await fetch('/api/reconnect', { method: 'POST' });
      await fetchStatus();
    } catch {}
    finally { setReconnecting(false); }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => { fetchStatus(); fetchLogs(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchLogs]);

  const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('en-IN');
  };

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6">
        {/* Bot Connection Status */}
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              WhatsApp Bot
            </h2>
            <button
              onClick={() => { console.log('[Settings] Refresh button clicked'); fetchStatus(); }}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 text-slate-300 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Status Indicator */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {status?.connected ? (
              <>
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Connected</span>
              </>
            ) : status?.qrPending ? (
              <>
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <QrCode className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-medium">Waiting for QR scan</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <WifiOff className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-medium">Disconnected</span>
                <button
                  onClick={handleReconnect}
                  disabled={reconnecting}
                  className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-sm transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
                  {reconnecting ? 'Clearing...' : 'Reset & Reconnect'}
                </button>
              </>
            )}
          </div>

          {/* Stats Grid */}
          {status && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Messages Processed
                </div>
                <p className="text-xl font-bold text-slate-100">{status.messagesProcessed}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Uptime
                </div>
                <p className="text-xl font-bold text-slate-100">{formatUptime(status.uptimeSeconds)}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4">
                <div className="text-slate-400 text-xs mb-1">Last Message</div>
                <p className="text-sm font-medium text-slate-100">{formatDate(status.lastMessageAt)}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4">
                <div className="text-slate-400 text-xs mb-1">Session ID</div>
                <p className="text-sm font-medium text-slate-100 truncate">{status.sessionId}</p>
              </div>
            </div>
          )}

          {/* QR Code Display */}
          {status?.qrPending && (
            <div className="border border-slate-700/50 rounded-lg p-6 bg-slate-800/20">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">Scan QR Code</h3>
              <p className="text-slate-400 text-sm mb-4">
                Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device
              </p>
              {qrLoading ? (
                <div className="w-[300px] h-[300px] bg-slate-800/50 rounded-lg flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : qrUrl ? (
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img src={qrUrl} alt="WhatsApp QR Code" className="w-[268px] h-[268px]" />
                </div>
              ) : (
                <div className="w-[300px] h-[300px] bg-slate-800/50 rounded-lg flex items-center justify-center">
                  <p className="text-slate-400 text-sm">QR code generating...</p>
                </div>
              )}
              <p className="text-slate-500 text-xs mt-3">QR code refreshes automatically every 5 seconds</p>
            </div>
          )}
        </div>

        {/* Message Logs */}
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-100">Message Logs</h2>
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 text-slate-300 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {logs.length === 0 ? (
            <p className="text-slate-500 text-sm">No messages received yet. Send a message to a monitored group to see it here.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {log.status === 'saved' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {log.status === 'not_transaction' && <XCircle className="w-4 h-4 text-slate-500" />}
                    {log.status === 'duplicate' && <Copy className="w-4 h-4 text-amber-400" />}
                    {log.status === 'skipped' && <SkipForward className="w-4 h-4 text-slate-600" />}
                    {log.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        log.status === 'saved' ? 'bg-emerald-500/20 text-emerald-400' :
                        log.status === 'skipped' ? 'bg-slate-700/50 text-slate-500' :
                        log.status === 'duplicate' ? 'bg-amber-500/20 text-amber-400' :
                        log.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-700/50 text-slate-400'
                      }`}>
                        {log.status === 'saved' ? `Saved ₹${log.amount}` :
                         log.status === 'not_transaction' ? 'Not a transaction' :
                         log.status === 'duplicate' ? 'Duplicate' :
                         log.status === 'skipped' ? 'Skipped' : 'Error'}
                      </span>
                      {log.group_name && (
                        <span className="text-xs text-slate-500 truncate max-w-[160px]">{log.group_name}</span>
                      )}
                      {log.sender && (
                        <span className="text-xs text-slate-400">{log.sender}</span>
                      )}
                      <span className="text-xs text-slate-600 ml-auto">
                        {new Date(log.created_at).toLocaleTimeString('en-IN')}
                      </span>
                    </div>
                    {log.text_preview && (
                      <p className="text-sm text-slate-300 mt-1 truncate">{log.text_preview}</p>
                    )}
                    {log.skip_reason && (
                      <p className="text-xs text-slate-600 mt-0.5">{log.skip_reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bot Setup Instructions */}
        {!status?.connected && !status?.qrPending && (
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4">How to Connect</h2>
            <div className="space-y-4 text-slate-300">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-sm font-bold">1</span>
                <div>
                  <p className="font-medium">Start the bot process</p>
                  <p className="text-slate-400 text-sm mt-1">Run <code className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400">npm run bot:dev</code> in a separate terminal</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-sm font-bold">2</span>
                <div>
                  <p className="font-medium">Scan the QR code</p>
                  <p className="text-slate-400 text-sm mt-1">A QR code will appear on this page. Scan it with WhatsApp &gt; Linked Devices</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-sm font-bold">3</span>
                <div>
                  <p className="font-medium">Configure monitored groups</p>
                  <p className="text-slate-400 text-sm mt-1">Once connected, go to the <strong>Groups</strong> page to select which WhatsApp groups the bot should monitor</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-sm font-bold">4</span>
                <div>
                  <p className="font-medium">Start sending messages</p>
                  <p className="text-slate-400 text-sm mt-1">Send payment messages or UPI screenshots to your monitored groups. The bot will extract and save transactions automatically.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-400 text-sm">
                <strong>For production:</strong> Deploy both the web app and bot to Railway. The bot runs as a separate long-running process using <code className="bg-slate-800 px-1.5 py-0.5 rounded">npm run bot:start</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
