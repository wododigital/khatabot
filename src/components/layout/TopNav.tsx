'use client';

import { useAuth } from '@/contexts/auth-context';
import { LogOut } from 'lucide-react';

interface TopNavProps {
  title?: string;
}

export function TopNav({ title = 'Dashboard' }: TopNavProps): React.ReactElement {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-slate-900/40 border-b border-slate-700/50 backdrop-blur-xl px-4 md:px-8 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-slate-400">{user.email || user.id}</span>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
