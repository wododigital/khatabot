'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useState } from 'react';
import { getTransactions } from '@/lib/supabase/queries';
import type { Transaction } from '@/types';

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getTransactions({});

        if (Array.isArray(data)) {
          setTransactions(data);

          // Calculate stats
          const today = new Date().toISOString().split('T')[0];
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          const todayTotal = data
            .filter((t: Transaction) => t.txn_date === today)
            .reduce((sum: number, t: Transaction) => sum + t.amount, 0);
          const weekTotal = data
            .filter((t: Transaction) => t.txn_date && t.txn_date >= weekAgo)
            .reduce((sum: number, t: Transaction) => sum + t.amount, 0);
          const monthTotal = data
            .filter((t: Transaction) => t.txn_date && t.txn_date >= monthAgo)
            .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

          setStats({ today: todayTotal, week: weekTotal, month: monthTotal });
        }
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">Today</p>
            <p className="text-2xl font-bold text-slate-100">
              ₹{stats.today.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">This Week</p>
            <p className="text-2xl font-bold text-slate-100">
              ₹{stats.week.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">This Month</p>
            <p className="text-2xl font-bold text-slate-100">
              ₹{stats.month.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Recent Transactions</h2>
          {loading ? (
            <p className="text-slate-400">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-slate-400">No transactions yet. Send a payment message to your WhatsApp group!</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-100">{txn.person_name}</p>
                    <p className="text-sm text-slate-400">{txn.purpose}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">₹{txn.amount}</p>
                    <p className="text-xs text-slate-500">{txn.payment_mode}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
