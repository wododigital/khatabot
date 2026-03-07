'use client';

export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import { getTransactions } from '@/lib/supabase/queries';
import type { Transaction } from '@/types';
import Link from 'next/link';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const data = await getTransactions({});

        if (Array.isArray(data)) {
          setTransactions(data);
        }
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [page]);

  return (
    <DashboardLayout title="Transactions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100">All Transactions</h1>
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No transactions found. Start sending payment messages!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Person</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Purpose</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Mode</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Amount</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {new Date(txn.txn_date || txn.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-100 font-medium">
                        {txn.person_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{txn.purpose || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        <span className="px-2 py-1 rounded-full text-xs bg-slate-800/50">
                          {txn.payment_mode || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-emerald-400 font-semibold text-right">
                        ₹{txn.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <Link
                          href={`/transactions/${txn.id}`}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && transactions.length > 0 && (
          <div className="flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-50 text-slate-300"
            >
              Previous
            </button>
            <span className="text-slate-400">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={transactions.length < 50}
              className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-50 text-slate-300"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
