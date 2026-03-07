'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTransactions } from '@/lib/supabase/queries';
import type { Transaction } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

// ============================================================
// HELPERS
// ============================================================

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // last day of month
  return {
    label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    dateFrom: start.toISOString().split('T')[0],
    dateTo: end.toISOString().split('T')[0],
    year,
    month,
    daysInMonth: end.getDate(),
  };
}

function formatCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function downloadCsv(transactions: Transaction[], filename: string) {
  const headers = [
    'Date',
    'Person',
    'Purpose',
    'Category',
    'Payment Mode',
    'Amount',
  ];
  const rows = transactions.map((t) => [
    t.txn_date || t.created_at.split('T')[0],
    `"${(t.person_name || '').replace(/"/g, '""')}"`,
    `"${(t.purpose || '').replace(/"/g, '""')}"`,
    t.category,
    t.payment_mode || '',
    t.amount.toString(),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// CUSTOM TOOLTIP
// ============================================================

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-300 text-xs mb-1">{label}</p>
      <p className="text-emerald-400 font-semibold text-sm">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

// ============================================================
// PAGE COMPONENT
// ============================================================

export default function ReportsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const monthInfo = useMemo(
    () => getMonthRange(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  // Fetch all non-deleted transactions once
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getTransactions({});
        if (!cancelled && Array.isArray(data)) {
          setAllTransactions(data);
        }
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter to selected month
  const filtered = useMemo(() => {
    return allTransactions.filter((t) => {
      const d = t.txn_date || t.created_at.split('T')[0];
      return d >= monthInfo.dateFrom && d <= monthInfo.dateTo;
    });
  }, [allTransactions, monthInfo]);

  // ---- Computed stats ----
  const totalSpent = useMemo(
    () => filtered.reduce((s, t) => s + t.amount, 0),
    [filtered]
  );
  const avgTransaction = filtered.length > 0 ? totalSpent / filtered.length : 0;

  const categoryMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return map;
  }, [filtered]);

  const topCategory = useMemo(() => {
    let best = '-';
    let max = 0;
    for (const [cat, amt] of Object.entries(categoryMap)) {
      if (amt > max) {
        max = amt;
        best = cat;
      }
    }
    return best;
  }, [categoryMap]);

  const categoryData = useMemo(() => {
    return Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [categoryMap]);

  const personData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      map[t.person_name] = (map[t.person_name] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filtered]);

  const dailyData = useMemo(() => {
    const map: Record<number, number> = {};
    for (let d = 1; d <= monthInfo.daysInMonth; d++) map[d] = 0;
    for (const t of filtered) {
      const dateStr = t.txn_date || t.created_at.split('T')[0];
      const day = parseInt(dateStr.split('-')[2], 10);
      if (day >= 1 && day <= monthInfo.daysInMonth) {
        map[day] += t.amount;
      }
    }
    return Object.entries(map)
      .map(([day, amount]) => ({ day: `${day}`, amount }))
      .sort((a, b) => parseInt(a.day) - parseInt(b.day));
  }, [filtered, monthInfo]);

  // ---- Month navigation ----
  const prevMonth = useCallback(() => {
    if (selectedMonth === 0) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }, [selectedMonth]);

  const nextMonth = useCallback(() => {
    if (selectedMonth === 11) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }, [selectedMonth]);

  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  // ---- Chart colors ----
  const CHART_COLORS = [
    '#10b981', // emerald-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
    '#22d3ee', // cyan-400
    '#34d399', // emerald-400
    '#2dd4bf', // teal-400
    '#6ee7b7', // emerald-300
    '#5eead4', // teal-300
    '#67e8f9', // cyan-300
    '#a7f3d0', // emerald-200
  ];

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-6">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>

          <div className="flex items-center gap-3">
            {/* CSV Export */}
            <button
              onClick={() =>
                downloadCsv(filtered, `transactions-${monthInfo.dateFrom}.csv`)
              }
              disabled={loading || filtered.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>

            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg px-3 py-2">
              <button
                onClick={prevMonth}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                aria-label="Previous month"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-slate-100 text-sm font-medium min-w-[140px] text-center">
                {monthInfo.label}
              </span>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next month"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
            <p className="text-slate-400">Loading transactions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-12 text-center">
            <p className="text-slate-400 text-lg mb-2">
              No transactions for {monthInfo.label}
            </p>
            <p className="text-slate-500 text-sm">
              Try selecting a different month or add some transactions first.
            </p>
          </div>
        ) : (
          <>
            {/* ======== Summary Stats ======== */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
                  Total Spent
                </p>
                <p className="text-xl font-bold text-emerald-400">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
              <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
                  Transactions
                </p>
                <p className="text-xl font-bold text-slate-100">
                  {filtered.length}
                </p>
              </div>
              <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
                  Average
                </p>
                <p className="text-xl font-bold text-slate-100">
                  {formatCurrency(Math.round(avgTransaction))}
                </p>
              </div>
              <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-5">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
                  Top Category
                </p>
                <p className="text-xl font-bold text-teal-400 capitalize">
                  {topCategory}
                </p>
              </div>
            </div>

            {/* ======== Category Breakdown ======== */}
            <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">
                Category Breakdown
              </h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                      }
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {categoryData.map((_entry, idx) => (
                        <rect
                          key={idx}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ======== Spending by Person ======== */}
            <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">
                Spending by Person (Top 10)
              </h2>
              <div
                className="h-[350px]"
                style={{ minHeight: Math.max(200, personData.length * 40) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={personData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                      }
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="amount"
                      fill="#14b8a6"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ======== Monthly Trend (Daily) ======== */}
            <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">
                Daily Spending - {monthInfo.label}
              </h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dailyData}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                      interval={Math.floor(monthInfo.daysInMonth / 10)}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                      }
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#34d399', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
