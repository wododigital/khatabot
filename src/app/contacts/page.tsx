'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useState } from 'react';
import { getContacts, insertContact, updateContact, deleteContact } from '@/lib/supabase/queries';
import type { Contact } from '@/types';
import { Plus, Trash2, Edit2, X, User, Search, Save } from 'lucide-react';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAliases, setFormAliases] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await getContacts(search || undefined);
      setContacts(data);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadContacts(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const resetForm = () => {
    setFormName('');
    setFormAliases('');
    setFormPhone('');
    setFormRole('');
    setFormNotes('');
    setError(null);
  };

  const openEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormName(contact.name);
    setFormAliases((contact.aliases || []).join(', '));
    setFormPhone(contact.phone || '');
    setFormRole(contact.role || '');
    setFormNotes(contact.notes || '');
    setShowAdd(false);
    setError(null);
  };

  const handleAdd = async () => {
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const aliases = formAliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      const created = await insertContact({
        name: formName.trim(),
        aliases,
        phone: formPhone.trim() || null,
        role: formRole.trim() || null,
        notes: formNotes.trim() || null,
      });
      setContacts((prev) => [created, ...prev]);
      resetForm();
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formName.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const aliases = formAliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      const updated = await updateContact(editingId, {
        name: formName.trim(),
        aliases,
        phone: formPhone.trim() || null,
        role: formRole.trim() || null,
        notes: formNotes.trim() || null,
      });
      setContacts((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      resetForm();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Delete contact "${contact.name}"?`)) return;
    try {
      await deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      if (editingId === contact.id) {
        setEditingId(null);
        resetForm();
      }
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  const isFormOpen = showAdd || editingId;

  return (
    <DashboardLayout title="Contacts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/40 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); resetForm(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>

        {/* Add/Edit Form */}
        {isFormOpen && (
          <div className="bg-slate-900/40 border border-emerald-500/30 backdrop-blur-xl rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingId ? 'Edit Contact' : 'New Contact'}
              </h3>
              <button
                onClick={() => { setShowAdd(false); setEditingId(null); resetForm(); }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Raju"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Aliases (comma-separated)</label>
                <input
                  type="text"
                  value={formAliases}
                  onChange={(e) => setFormAliases(e.target.value)}
                  placeholder="e.g., Rajesh, Raju bhai"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g., 9876543210"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Role</label>
                <input
                  type="text"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g., labourer, supplier, electrician"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={editingId ? handleUpdate : handleAdd}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Contact'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setEditingId(null); resetForm(); }}
                className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contacts List */}
        {loading ? (
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8 text-center text-slate-400">
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8 text-center">
            <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 mb-2">{search ? 'No contacts match your search' : 'No contacts yet'}</p>
            <p className="text-slate-500 text-sm">
              Add contacts so the bot can match extracted names consistently.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300 hidden md:table-cell">Aliases</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300 hidden md:table-cell">Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300 hidden lg:table-cell">Role</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-100">{contact.name}</p>
                      <p className="text-xs text-slate-500 md:hidden">
                        {contact.role || ''} {contact.phone ? `| ${contact.phone}` : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 hidden md:table-cell">
                      {contact.aliases?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {contact.aliases.map((a, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-slate-800/50 border border-slate-700/50">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 hidden md:table-cell">
                      {contact.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 hidden lg:table-cell">
                      {contact.role || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(contact)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
