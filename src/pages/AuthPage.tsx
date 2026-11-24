import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { Button, Card, Input, Select } from '../components/ui/primitives.tsx';
import { api } from '../lib/api.ts';

export function AuthPage() {
  const { refetchUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [occupation, setOccupation] = useState('');

  // First-run admin claim state
  const [adminName, setAdminName] = useState('Vikramaditya Rao');
  const [adminEmail, setAdminEmail] = useState('admin@havenstay.in');
  const [adminPassword, setAdminPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setupQuery = useQuery({
    queryKey: ['auth', 'setup-status'],
    queryFn: () => api.setupStatus(),
    retry: false,
  });

  const needsFirstRunAdmin = setupQuery.data?.hasAdmin === false;

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await api.bootstrapAdmin({ adminName, adminEmail, adminPassword });
      await queryClient.invalidateQueries();
      await refetchUser();
      navigate('/admin');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({ name, email, phone, password, gender, occupation });

      await refetchUser();

      if (res.user.role === 'admin') {
        navigate('/admin');
      } else if (res.user.role === 'resident') {
        navigate('/resident');
      } else {
        navigate('/');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      {setupQuery.isError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {setupQuery.error instanceof Error
            ? setupQuery.error.message
            : 'Database temporarily unavailable. Check MongoDB Atlas Network Access (0.0.0.0/0).'}
        </div>
      )}
      {needsFirstRunAdmin ? (
        <Card className="p-6 sm:p-8">
          <p className="text-xs font-medium text-[#0f766e]">First-Run Setup</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
            Claim Admin & Initialize Portal
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Set your admin password to unlock the Admin Console and initialize sample resident,
            invoice, and maintenance records.
          </p>

          <form onSubmit={handleBootstrap} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Admin Name</label>
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Admin Email</label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Choose Admin Password (min 8 chars)
              </label>
              <Input
                type="password"
                minLength={8}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter a strong password"
                required
              />
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Initializing...' : 'Claim Admin & Seed Portal'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Guest Sign Up
            </button>
          </div>

          <h1 className="mt-6 font-display text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'Access your HavenStay portal' : 'Create a prospective tenant account'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'login'
              ? 'Sign in with your resident, admin, or guest credentials.'
              : 'Reserve beds and track your scheduled property tours.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Full Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rohan Kulkarni"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98450 12345"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Gender</label>
                    <Select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Occupation / Company
                  </label>
                  <Input
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Software Engineer"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya.nair@havenstay.in"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
              />
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? 'Authenticating...'
                : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
            </Button>
          </form>

          {mode === 'login' && (
            <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">Sample Resident & Guest Emails:</p>
              <p>Admin: admin@havenstay.in</p>
              <p>Resident: priya.nair@havenstay.in · arjun.mehta@havenstay.in</p>
              <p>Guest: ananya.sharma@havenstay.in</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
