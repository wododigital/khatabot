'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function SettingsPage() {
  return (
    <DashboardLayout title="Settings">
      <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Settings</h2>
        <p className="text-slate-400">Bot settings and configuration coming soon.</p>
      </div>
    </DashboardLayout>
  );
}
