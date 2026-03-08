'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, QrCode, MessageSquare, Clock, AlertCircle } from 'lucide-react';

interface BotStatus {
  connected: boolean;
  sessionId: string;
  lastMessageAt: string | null;
  messagesProcessed: number;
  uptimeSeconds: number;
  qrPending: boolean;
  timestamp: string;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setQrUrl(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      console.error('[Settings] fetchStatus error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
      console.log('[Settings] fetchStatus done, loading set to false');
    }
  }, []);

  const fetchQR = async () => {
    console.log('[Settings] fetchQR called');
    setQrLoading(true);
    try {
      const res = await fetch('/api/qr', { cache: 'no-store' });
      const contentType = res.headers.get('Content-Type');
      console.log('[Settings] QR response status:', res.status, 'content-type:', contentType);
      if (contentType?.includes('image/png')) {
        const blob = await res.blob();
        console.log('[Settings] QR blob size:', blob.size);
        const url = URL.createObjectURL(blob);
        setQrUrl(url);
      } else {
        const body = await res.text();
        console.log('[Settings] QR response (not PNG):', body);
        setQrUrl(null);
      }
    } catch (err) {
      console.error('[Settings] fetchQR error:', err);
      setQrUrl(null);
    } finally {
      setQrLoading(false);
      console.log('[Settings] fetchQR done');
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

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
          <div className="flex items-center gap-3 mb-6">
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
