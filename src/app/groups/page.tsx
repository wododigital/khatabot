'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect, useState } from 'react';
import { getGroups, updateGroup, insertGroup, deleteGroup } from '@/lib/supabase/queries';
import type { Group } from '@/types';
import { Plus, Trash2, MessageSquare, Eye, EyeOff, X } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'home', label: 'Home', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
  { value: 'personal', label: 'Personal', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
  { value: 'company', label: 'Company', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
  { value: 'custom', label: 'Custom', color: 'bg-slate-500/20 text-slate-400 border-slate-500/50' },
] as const;

function getCategoryStyle(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.color || CATEGORY_OPTIONS[3].color;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newJid, setNewJid] = useState('');
  const [newCategory, setNewCategory] = useState<string>('custom');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await getGroups();
      setGroups(data);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleToggleActive = async (group: Group) => {
    try {
      await updateGroup(group.id, { is_active: !group.is_active });
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, is_active: !g.is_active } : g))
      );
    } catch (err) {
      console.error('Failed to toggle group:', err);
    }
  };

  const handleCategoryChange = async (group: Group, category: string) => {
    try {
      await updateGroup(group.id, { category });
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, category: category as Group['category'] } : g))
      );
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const handleAddGroup = async () => {
    if (!newName.trim()) {
      setError('Group name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const jid = newJid.trim() || `manual-${Date.now()}@g.us`;
      const created = await insertGroup({
        wa_group_jid: jid,
        name: newName.trim(),
        category: newCategory as 'home' | 'personal' | 'company' | 'custom',
        is_active: true,
      });
      setGroups((prev) => [created, ...prev]);
      setNewName('');
      setNewJid('');
      setNewCategory('custom');
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: Group) => {
    if (!confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    try {
      await deleteGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const activeCount = groups.filter((g) => g.is_active).length;

  return (
    <DashboardLayout title="Groups">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">
              {groups.length} groups found, {activeCount} monitored
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-4">
          <p className="text-slate-400 text-sm">
            <strong className="text-slate-200">How it works:</strong> When the WhatsApp bot connects, it automatically discovers all your WhatsApp groups and lists them here. Toggle <strong className="text-emerald-400">Monitoring</strong> on for groups you want the bot to read. Only monitored groups will have their messages processed.
          </p>
        </div>

        {/* Add Group Modal */}
        {showAdd && (
          <div className="bg-slate-900/40 border border-emerald-500/30 backdrop-blur-xl rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Add Group Manually</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Home Expenses"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">WhatsApp Group JID (optional)</label>
                <input
                  type="text"
                  value={newJid}
                  onChange={(e) => setNewJid(e.target.value)}
                  placeholder="Auto-detected when bot connects"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:border-emerald-500/50"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAddGroup}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Group'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Groups List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8 text-center text-slate-400">
              Loading groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-2">No groups yet</p>
              <p className="text-slate-500 text-sm">Start the bot to auto-discover your WhatsApp groups, or add one manually.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className={`bg-slate-900/40 border backdrop-blur-xl rounded-lg p-4 flex items-center justify-between gap-4 transition-colors ${
                  group.is_active ? 'border-emerald-500/30' : 'border-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    group.is_active ? 'bg-emerald-500/20' : 'bg-slate-800/50'
                  }`}>
                    <MessageSquare className={`w-5 h-5 ${group.is_active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100 truncate">{group.name}</p>
                    <p className="text-xs text-slate-500 truncate">{group.wa_group_jid}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Category Selector */}
                  <select
                    value={group.category}
                    onChange={(e) => handleCategoryChange(group, e.target.value)}
                    className={`px-2 py-1 rounded-full text-xs border ${getCategoryStyle(group.category)} bg-transparent cursor-pointer focus:outline-none`}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-800 text-slate-100">
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Toggle Monitoring */}
                  <button
                    onClick={() => handleToggleActive(group)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      group.is_active
                        ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {group.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {group.is_active ? 'Monitoring' : 'Ignored'}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(group)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
