'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useState } from 'react';
import { getTransactions } from '@/lib/supabase/queries';
import type { Transaction } from '@/types';
import Link from 'next/link';
import { ArrowUpRight, TrendingUp, Calendar, IndianRupee, Users, Wifi, WifiOff } from 'lucide-react';

interface BotStatusData {
  connected: boolean;
  messagesProcessed: number;
  qrPending: boolean;
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<BotStatusData | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, statusRes] = await Promise.all([
          getTransactions({}),
          fetch('/api/bot-status').then((r) => r.json()).catch(() => null),
        ]);
        if (Array.isArray(data)) setTransactions(data);
        if (statusRes) setBotStatus(statusRes);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const todayTotal = transactions
    .filter((t) => t.txn_date === today)
    .reduce((s, t) => s + t.amount, 0);
  const weekTotal = transactions
    .filter((t) => t.txn_date && t.txn_date >= weekAgo)
    .reduce((s, t) => s + t.amount, 0);
  const monthTotal = transactions
    .filter((t) => t.txn_date && t.txn_date >= monthStart)
    .reduce((s, t) => s + t.amount, 0);
  const txnCount = transactions.length;

  // Category breakdown for this month
  const categoryTotals: Record<string, number> = {};
  transactions
    .filter((t) => t.txn_date && t.txn_date >= monthStart)
    .forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Top people this month
  const personTotals: Record<string, number> = {};
  transactions
    .filter((t) => t.txn_date && t.txn_date >= monthStart)
    .forEach((t) => {
      personTotals[t.person_name] = (personTotals[t.person_name] || 0) + t.amount;
    });
  const topPeople = Object.entries(personTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const recentTxns = transactions.slice(0, 8);

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Bot Status Banner */}
        {botStatus && !botStatus.connected && (
          <Link
            href="/settings"
            className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors"
          >
            {botStatus.qrPending ? (
              <>
                <WifiOff className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 text-sm">WhatsApp bot needs QR scan. Click here to connect.</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 text-sm">WhatsApp bot is not running. Go to Settings to connect.</span>
              </>
            )}
            <ArrowUpRight className="w-4 h-4 text-amber-400 ml-auto" />
          </Link>
        )}

        {botStatus?.connected && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm">Bot connected - {botStatus.messagesProcessed} messages processed</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Calendar className="w-3.5 h-3.5" />
              Today
            </div>
            <p className="text-2xl font-bold text-slate-100">₹{todayTotal.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              This Week
            </div>
            <p className="text-2xl font-bold text-slate-100">₹{weekTotal.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <IndianRupee className="w-3.5 h-3.5" />
              This Month
            </div>
            <p className="text-2xl font-bold text-emerald-400">₹{monthTotal.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Users className="w-3.5 h-3.5" />
              Total Transactions
            </div>
            <p className="text-2xl font-bold text-slate-100">{txnCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">This Month by Category</h2>
            {topCategories.length === 0 ? (
              <p className="text-slate-500 text-sm">No transactions this month</p>
            ) : (
              <div className="space-y-3">
                {topCategories.map(([cat, amount]) => {
                  const pct = monthTotal > 0 ? (amount / monthTotal) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300 capitalize">{cat}</span>
                        <span className="text-slate-400">₹{amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top People */}
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Top People This Month</h2>
            {topPeople.length === 0 ? (
              <p className="text-slate-500 text-sm">No transactions this month</p>
            ) : (
              <div className="space-y-3">
                {topPeople.map(([person, amount], i) => (
                  <div key={person} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/20">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 font-medium">
                        {i + 1}
                      </span>
                      <span className="text-slate-100 text-sm">{person}</span>
                    </div>
                    <span className="text-emerald-400 text-sm font-medium">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-100">Recent Transactions</h2>
            <Link
              href="/transactions"
              className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : recentTxns.length === 0 ? (
            <p className="text-slate-500 text-sm">No transactions yet. Connect WhatsApp and send a payment message!</p>
          ) : (
            <div className="space-y-2">
              {recentTxns.map((txn) => (
                <Link
                  key={txn.id}
                  href={`/transactions/${txn.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-100 text-sm">{txn.person_name}</p>
                      {txn.confidence !== null && txn.confidence !== undefined && txn.confidence < 0.7 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">Low confidence</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{txn.purpose || txn.category}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-semibold text-emerald-400 text-sm">₹{txn.amount.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(txn.txn_date || txn.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
