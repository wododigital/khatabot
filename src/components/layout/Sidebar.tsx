'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Send,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Send },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/groups', label: 'Groups', icon: MessageSquare },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside className="hidden md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:flex md:flex-col bg-slate-900/50 border-r border-slate-700/50 backdrop-blur-xl">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700/50">
        <h1 className="text-2xl font-bold text-emerald-500">KhataBot</h1>
        <p className="text-xs text-slate-400 mt-1">Finance Tracker</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (pathname.startsWith(item.href) && item.href !== '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/50 text-xs text-slate-400">
        <p>v1.0.0</p>
      </div>
    </aside>
  );
}
