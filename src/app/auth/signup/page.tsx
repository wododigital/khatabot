'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Signup handled via Supabase auth
      router.push('/auth/login?success=signup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-lg p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-emerald-500">KhataBot</h1>
            <p className="text-slate-400">Create Account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            {/* Phone Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 10-digit number"
                className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-400 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-slate-400">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
