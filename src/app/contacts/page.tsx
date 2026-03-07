'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function ContactsPage() {
  return (
    <DashboardLayout title="Contacts">
      <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Contacts</h2>
        <p className="text-slate-400">Contact management coming soon.</p>
      </div>
    </DashboardLayout>
  );
}
