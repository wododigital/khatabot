'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Signup redirect page
 * Redirects to login since user registration is disabled
 * Users must be created via Supabase admin panel or API
 */
export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page
    router.push('/auth/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Redirecting to login...</div>
    </div>
  );
}
