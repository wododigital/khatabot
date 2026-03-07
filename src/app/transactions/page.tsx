'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useState, useEffect, useMemo } from 'react';
import { getTransactions, getGroups } from '@/lib/supabase/queries';
import type { Transaction, Group, TransactionFilters } from '@/types';
import Link from 'next/link';
import { Search, Download, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 50;

const CATEGORY_COLORS: Record<string, string> = {
  income: 'bg-green-500/20 text-green-400',
  expense: 'bg-red-500/20 text-red-400',
  transfer: 'bg-blue-500/20 text-blue-400',
  debt: 'bg-amber-500/20 text-amber-400',
  food: 'bg-orange-500/20 text-orange-400',
  transport: 'bg-cyan-500/20 text-cyan-400',
  other: 'bg-slate-500/20 text-slate-400',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const filters: TransactionFilters = {};
      if (searchQuery.trim()) filters.search_query = searchQuery.trim();
      if (filterCategory) filters.category = filterCategory;
      if (filterPaymentMode) filters.payment_mode = filterPaymentMode;
      if (filterGroupId) filters.group_id = filterGroupId;
      if (filterDateFrom) filters.date_from = filterDateFrom;
      if (filterDateTo) filters.date_to = filterDateTo;

      const [txns, grps] = await Promise.all([
        getTransactions(filters),
        getGroups(),
      ]);
      setTransactions(Array.isArray(txns) ? txns : []);
      setGroups(Array.isArray(grps) ? grps : []);
      setPage(1);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => loadData(), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, filterCategory, filterPaymentMode, filterGroupId, filterDateFrom, filterDateTo]);

  const paginatedTxns = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return transactions.slice(start, start + PAGE_SIZE);
  }, [transactions, page]);

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterPaymentMode('');
    setFilterGroupId('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasFilters = searchQuery || filterCategory || filterPaymentMode || filterGroupId || filterDateFrom || filterDateTo;

  const exportCSV = () => {
    const headers = ['Date', 'Person', 'Amount', 'Purpose', 'Category', 'Payment Mode', 'Txn ID', 'Notes'];
    const rows = transactions.map((t) => [
      t.txn_date || t.created_at.split('T')[0],
      t.person_name,
      t.amount.toString(),
      t.purpose || '',
      t.category,
      t.payment_mode || '',
      t.txn_id || '',
      t.notes || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `khatabot-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Transactions">
      <div className="space-y-4">
        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by person, purpose, or notes..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/40 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showFilters || hasFilters
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-900/40 border-slate-700/50 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasFilters && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
            </button>
            <button
              onClick={exportCSV}
              disabled={transactions.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700/50 text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">Filters</span>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">All</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                  <option value="debt">Debt</option>
                  <option value="food">Food</option>
                  <option value="transport">Transport</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Payment Mode</label>
                <select
                  value={filterPaymentMode}
                  onChange={(e) => setFilterPaymentMode(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">All</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Group</label>
                <select
                  value={filterGroupId}
                  onChange={(e) => setFilterGroupId(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">All Groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Summary Bar */}
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{transactions.length} transactions{hasFilters ? ' (filtered)' : ''}</span>
          <span>Total: <strong className="text-emerald-400">₹{totalAmount.toLocaleString('en-IN')}</strong></span>
        </div>

        {/* Table */}
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              {hasFilters ? 'No transactions match your filters.' : 'No transactions yet. Send a payment message to your WhatsApp group!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Person</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300 hidden md:table-cell">Purpose</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300 hidden lg:table-cell">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300 hidden lg:table-cell">Mode</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Amount</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {paginatedTxns.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                        {new Date(txn.txn_date || txn.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-100 font-medium">{txn.person_name}</p>
                        <p className="text-xs text-slate-500 md:hidden truncate max-w-[150px]">{txn.purpose || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 hidden md:table-cell max-w-[200px] truncate">
                        {txn.purpose || '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(txn.category)}`}>
                          {txn.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 hidden lg:table-cell">
                        {txn.payment_mode || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-emerald-400 font-semibold text-right whitespace-nowrap">
                        ₹{txn.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/transactions/${txn.id}`}
                          className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
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
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-50 text-slate-300 text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-slate-400 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-50 text-slate-300 text-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
