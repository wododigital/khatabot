'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSupabaseClient } from '@/hooks/useSupabase';
import {
  getTransactionById,
  updateTransaction,
} from '@/lib/supabase/queries';
import { TRANSACTION_CATEGORIES, PAYMENT_MODES } from '@/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TransactionWithRelations } from '@/types';
import { format } from 'date-fns';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function TransactionDetailPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams();
  const client = useSupabaseClient();
  const id = params.id as string;

  const [transaction, setTransaction] = useState<TransactionWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: 0,
    person_name: '',
    category: '',
    payment_mode: '',
    txn_id: '',
    txn_date: '',
    notes: '',
  });

  useEffect(() => {
    const loadTransaction = async () => {
      try {
        setLoading(true);
        const data = await getTransactionById(client, id);
        if (data) {
          setTransaction(data);
          setFormData({
            amount: data.amount,
            person_name: data.person_name,
            category: data.category,
            payment_mode: data.payment_mode || '',
            txn_id: data.txn_id || '',
            txn_date: data.txn_date || '',
            notes: data.notes || '',
          });
        }
      } catch (error) {
        console.error('Failed to load transaction:', error);
        router.push('/transactions');
      } finally {
        setLoading(false);
      }
    };

    loadTransaction();
  }, [id, client, router]);

  const handleSave = async () => {
    if (!transaction) return;
    try {
      setSaving(true);
      await updateTransaction(client, transaction.id, {
        amount: formData.amount,
        person_name: formData.person_name,
        category: formData.category,
        payment_mode: (formData.payment_mode as any) || null,
        txn_id: formData.txn_id || null,
        txn_date: formData.txn_date || null,
        notes: formData.notes || null,
      });
      setEditing(false);
      const updatedData = await getTransactionById(client, id);
      if (updatedData) {
        setTransaction(updatedData);
      }
    } catch (error) {
      console.error('Failed to save transaction:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction || !confirm('Delete this transaction?')) return;
    try {
      setSaving(true);
      await updateTransaction(client, transaction.id, { is_deleted: true });
      router.push('/transactions');
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Transaction">
        <div className="text-center text-slate-400">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!transaction) {
    return (
      <DashboardLayout title="Transaction">
        <div className="text-center text-slate-400">Transaction not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Transaction Detail">
      <div className="space-y-6">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Transactions
        </Link>

        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-100">
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  minimumFractionDigits: 0,
                }).format(formData.amount)}
              </h2>
              <p className="text-slate-400 mt-1">{formData.person_name}</p>
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 text-slate-400 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30 text-blue-400 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-700/50">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Amount
              </label>
              {editing ? (
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              ) : (
                <p className="text-slate-100 font-semibold">
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                  }).format(formData.amount)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Person
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.person_name}
                  onChange={(e) =>
                    setFormData({ ...formData, person_name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              ) : (
                <p className="text-slate-100">{formData.person_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Category
              </label>
              {editing ? (
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50"
                >
                  {TRANSACTION_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-block px-3 py-1 rounded-full text-sm bg-slate-800/50 text-slate-300">
                  {formData.category}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Payment Mode
              </label>
              {editing ? (
                <select
                  value={formData.payment_mode}
                  onChange={(e) =>
                    setFormData({ ...formData, payment_mode: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">None</option>
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-slate-400">
                  {formData.payment_mode || '-'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Transaction ID
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.txn_id}
                  onChange={(e) =>
                    setFormData({ ...formData, txn_id: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              ) : (
                <p className="text-slate-400">{formData.txn_id || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Date
              </label>
              {editing ? (
                <input
                  type="date"
                  value={formData.txn_date}
                  onChange={(e) =>
                    setFormData({ ...formData, txn_date: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50"
                />
              ) : (
                <p className="text-slate-400">
                  {formData.txn_date
                    ? format(new Date(formData.txn_date), 'MMM dd, yyyy')
                    : '-'}
                </p>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-700/50">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notes
            </label>
            {editing ? (
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50 resize-none"
                rows={4}
              />
            ) : (
              <p className="text-slate-400">
                {formData.notes || 'No notes'}
              </p>
            )}
          </div>

          <div className="pt-6 border-t border-slate-700/50 space-y-2 text-sm text-slate-500">
            <p>Created: {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}</p>
            <p>Updated: {format(new Date(transaction.updated_at), 'MMM dd, yyyy HH:mm')}</p>
            {transaction.contact && (
              <p>Contact: {transaction.contact.name}</p>
            )}
            {transaction.group && (
              <p>Group: {transaction.group.name}</p>
            )}
            {transaction.confidence ? (
              <p>Confidence: {(transaction.confidence * 100).toFixed(0)}%</p>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
