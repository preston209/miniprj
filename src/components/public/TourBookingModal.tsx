import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Video, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../lib/api.ts';
import type { SharingType } from '../../types/pg.ts';
import { Button, Input, Select, Textarea } from '../ui/primitives.tsx';

const TIME_SLOTS = ['10:30 AM', '12:00 PM', '03:00 PM', '05:30 PM', '07:00 PM'];

export function TourBookingModal() {
  const { user, tourModalOpen, tourPrefill, closeTourModal } = useAuth();

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  const [tourMode, setTourMode] = useState<'physical' | 'virtual'>('physical');
  const [tourSlotDate, setTourSlotDate] = useState(tomorrow);
  const [tourSlotTime, setTourSlotTime] = useState('12:00 PM');
  const [sharingPreference, setSharingPreference] = useState<SharingType>('double');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [moveInTimeline, setMoveInTimeline] = useState('Within 15 days');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  useEffect(() => {
    if (tourModalOpen) {
      setConfirmedId(null);
      setErrorMsg(null);
      setTourMode(tourPrefill.tourMode ?? 'physical');
      setSharingPreference(tourPrefill.sharingPreference ?? 'double');
      setNotes(
        tourPrefill.roomNumber
          ? `Interested in Room ${tourPrefill.roomNumber}`
          : tourPrefill.notes ?? ''
      );
      if (user) {
        setLeadName(user.name);
        setLeadEmail(user.email);
        setLeadPhone(user.phone);
      }
    }
  }, [tourModalOpen, tourPrefill, user]);

  if (!tourModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await api.scheduleTour({
        roomId: tourPrefill.roomId,
        tourMode,
        tourSlotDate,
        tourSlotTime,
        leadName,
        leadEmail,
        leadPhone,
        sharingPreference,
        moveInTimeline,
        notes,
      });
      setConfirmedId(res.booking._id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to schedule tour.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={closeTourModal}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {confirmedId ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h3
              id="tour-modal-title"
              className="mt-4 font-display text-xl font-bold text-slate-900"
            >
              Tour Confirmed
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Your {tourMode === 'virtual' ? 'virtual video walkthrough' : 'in-person visit'} is
              booked for <span className="font-semibold">{tourSlotDate}</span> at{' '}
              <span className="font-semibold">{tourSlotTime}</span>.
            </p>
            <p className="mt-1 font-mono-tabular text-xs text-slate-500">
              Reference ID: {confirmedId}
            </p>
            <Button className="mt-6" onClick={closeTourModal}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3
                id="tour-modal-title"
                className="font-display text-xl font-bold text-slate-900"
              >
                Schedule a 1-Click Property Tour
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Visit HavenStay Koramangala in person or join a live video walkthrough.
              </p>
            </div>

            {/* Tour Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTourMode('physical')}
                className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors cursor-pointer ${
                  tourMode === 'physical'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Physical Visit
              </button>
              <button
                type="button"
                onClick={() => setTourMode('virtual')}
                className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors cursor-pointer ${
                  tourMode === 'virtual'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                Virtual Video Tour
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Preferred Date
                </label>
                <Input
                  type="date"
                  min={tomorrow}
                  value={tourSlotDate}
                  onChange={(e) => setTourSlotDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Room Sharing Preference
                </label>
                <Select
                  value={sharingPreference}
                  onChange={(e) => setSharingPreference(e.target.value as SharingType)}
                >
                  <option value="single">Single Studio</option>
                  <option value="double">Double Sharing</option>
                  <option value="triple">Triple Sharing</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Select Time Slot
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTourSlotTime(slot)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      tourSlotTime === slot
                        ? 'border-[#0f766e] bg-[#0f766e]/10 text-[#0f766e]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Full Name</label>
                <Input
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Riya Sharma"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
                <Input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="+91 98450 00000"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="riya@example.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Move-In Timeline
                </label>
                <Select
                  value={moveInTimeline}
                  onChange={(e) => setMoveInTimeline(e.target.value)}
                >
                  <option value="Immediate">Immediate</option>
                  <option value="Within 15 days">Within 15 days</option>
                  <option value="Next Month">Next Month</option>
                  <option value="Just Exploring">Just Exploring</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Notes (Optional)
              </label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific floor, AC, or dietary questions..."
              />
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </p>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="outline" onClick={closeTourModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Booking...' : 'Confirm Tour Slot'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
