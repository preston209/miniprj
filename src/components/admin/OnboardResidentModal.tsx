import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { formatINR } from '../../lib/utils.ts';
import type { BedMatrixItem, RoomData } from '../../types/pg.ts';
import { Button, Card, Input, Select } from '../ui/primitives.tsx';

export interface OnboardPrefill {
  name?: string;
  email?: string;
  phone?: string;
  bedId?: string;
  tourBookingId?: string;
}

interface OnboardResidentModalProps {
  open: boolean;
  prefill?: OnboardPrefill | null;
  availableBeds: BedMatrixItem[];
  rooms: RoomData[];
  onClose: () => void;
  onSuccessMessage?: (msg: string) => void;
}

export function OnboardResidentModal({
  open,
  prefill,
  availableBeds,
  rooms,
  onClose,
  onSuccessMessage,
}: OnboardResidentModalProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [occupation, setOccupation] = useState('');
  const [bedId, setBedId] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billingMonth, setBillingMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [electricityUnits, setElectricityUnits] = useState(0);
  const [includeDeposit, setIncludeDeposit] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(prefill?.name ?? '');
    setEmail(prefill?.email ?? '');
    setPhone(prefill?.phone ?? '');
    setPassword('');
    setGender('male');
    setOccupation('');
    setBedId(prefill?.bedId ?? availableBeds[0]?._id ?? '');
    setCheckInDate(new Date().toISOString().slice(0, 10));
    setBillingMonth(new Date().toISOString().slice(0, 7));
    setElectricityUnits(0);
    setIncludeDeposit(true);
    setErrorMsg(null);
  }, [open, prefill, availableBeds]);

  const onboardMutation = useMutation({
    mutationFn: api.onboardResident,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'beds'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'residents'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tours'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onSuccessMessage?.(res.message);
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to onboard resident.');
    },
  });

  if (!open) return null;

  const selectedBed = availableBeds.find((b) => b._id === bedId);
  const selectedRoom = rooms.find((r) => r._id === selectedBed?.roomId?._id);
  const rentPreview = selectedRoom?.monthlyRent ?? selectedBed?.roomId?.monthlyRent ?? 0;
  const depositPreview = includeDeposit ? selectedRoom?.securityDeposit ?? 0 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!bedId) {
      setErrorMsg('Please select an available bed.');
      return;
    }

    onboardMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      ...(password.trim() ? { password: password.trim() } : {}),
      gender,
      ...(occupation.trim() ? { occupation: occupation.trim() } : {}),
      bedId,
      checkInDate,
      billingMonth,
      electricityUnits: Number(electricityUnits) || 0,
      includeDeposit,
      ...(prefill?.tourBookingId ? { tourBookingId: prefill.tourBookingId } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
      <Card className="my-8 w-full max-w-lg p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#0f766e]" />
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {prefill?.tourBookingId ? 'Convert Tour Lead to Resident' : 'Onboard New Resident'}
              </h3>
              <p className="text-xs text-slate-500">
                Creates or upgrades resident account, assigns bed, syncs RAG, and generates initial invoice.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            aria-label="Close onboarding modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {availableBeds.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No available beds right now.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Create a new room or vacate an existing bed in the Bed Matrix before onboarding.
            </p>
            <Button variant="outline" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Resident Full Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="resident@example.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Initial Password (min 8 chars for new user)
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Optional if user already exists"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Occupation (Optional)
                </label>
                <Input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="Software Engineer"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Assign Available Bed
              </label>
              <Select value={bedId} onChange={(e) => setBedId(e.target.value)} required>
                {availableBeds.map((b) => (
                  <option key={b._id} value={b._id}>
                    Bed {b.bedCode} · Room {b.roomId?.roomNumber} ({b.roomId?.sharingType.toUpperCase()}
                    , {b.roomId?.isAC ? 'AC' : 'Non-AC'}) — {formatINR(b.roomId?.monthlyRent ?? 0)}/mo
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Check-In Date
                </label>
                <Input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Billing Month
                </label>
                <Input
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Initial Elec. Units
                </label>
                <Input
                  type="number"
                  min={0}
                  max={5000}
                  value={electricityUnits}
                  onChange={(e) => setElectricityUnits(Number(e.target.value))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDeposit}
                onChange={(e) => setIncludeDeposit(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#0f766e]"
              />
              Include refundable security deposit on initial invoice
            </label>

            {selectedBed && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Monthly Base Rent</span>
                  <span className="font-mono-tabular font-semibold">{formatINR(rentPreview)}</span>
                </div>
                {includeDeposit && depositPreview > 0 && (
                  <div className="mt-1 flex justify-between">
                    <span>Refundable Security Deposit</span>
                    <span className="font-mono-tabular font-semibold">
                      {formatINR(depositPreview)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={onboardMutation.isPending}>
                {onboardMutation.isPending ? 'Onboarding...' : 'Confirm & Generate Invoice'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
