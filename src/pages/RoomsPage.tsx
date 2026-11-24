import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PricingCalculator } from '../components/public/PricingCalculator.tsx';
import { RoomCard } from '../components/public/RoomCard.tsx';
import { Button, Card } from '../components/ui/primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { formatINR } from '../lib/utils.ts';
import type { RoomData } from '../types/pg.ts';

export function RoomsPage() {
  const { openTourModal } = useAuth();
  const [sharingFilter, setSharingFilter] = useState<'all' | 'single' | 'double' | 'triple'>('all');
  const [acFilter, setAcFilter] = useState<'all' | 'true' | 'false'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'any'>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedCalcRoom, setSelectedCalcRoom] = useState<RoomData | null>(null);

  const propertyQuery = useQuery({
    queryKey: ['property', 'primary'],
    queryFn: async () => (await api.getPrimaryProperty()).property ?? null,
    retry: false,
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms', sharingFilter, acFilter, genderFilter, onlyAvailable],
    queryFn: async () =>
      (
        await api.listRooms({
          sharingType: sharingFilter,
          isAC: acFilter,
          genderPreference: genderFilter,
          onlyAvailable,
        })
      ).rooms ?? [],
    retry: false,
  });

  const property = propertyQuery.data ?? null;
  const rooms = roomsQuery.data ?? [];

  const stats = useMemo(() => {
    const vacantTotal = rooms.reduce((sum, r) => sum + r.vacantBedsCount, 0);
    const minRent = rooms.length > 0 ? Math.min(...rooms.map((r) => r.monthlyRent)) : 0;
    return { vacantTotal, minRent };
  }, [rooms]);

  const dbUnavailable = propertyQuery.isError || roomsQuery.isError;
  const dbErrorText =
    (propertyQuery.error instanceof Error ? propertyQuery.error.message : null) ??
    (roomsQuery.error instanceof Error ? roomsQuery.error.message : null);

  const handleSelectForCalculator = (room: RoomData) => {
    setSelectedCalcRoom(room);
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[#0f766e]">
            {property
              ? `${property.name} · ${property.address.area}, ${property.address.city}`
              : 'Live Room & Bed Inventory'}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
            Rooms, Live Bed Availability &amp; Cost Estimator
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            Filter rooms by sharing configuration, air conditioning, gender wing, and immediate
            vacancies. Select any room to calculate exact monthly rent, sub-meter electricity, and
            refundable deposit.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
          <div>
            <p className="text-xs text-slate-500">Rooms Shown</p>
            <p className="mt-0.5 font-mono-tabular text-xl font-bold text-slate-900">
              {rooms.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Vacant Beds</p>
            <p className="mt-0.5 font-mono-tabular text-xl font-bold text-[#0f766e]">
              {rooms.length > 0 ? stats.vacantTotal : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Starting Rent</p>
            <p className="mt-0.5 font-mono-tabular text-xl font-bold text-slate-900">
              {stats.minRent > 0 ? formatINR(stats.minRent) : '—'}
            </p>
          </div>
        </div>
      </div>

      {dbUnavailable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Unable to load live rooms</p>
            <p className="mt-0.5 text-amber-800">{dbErrorText}</p>
          </div>
        </div>
      )}

      {/* Interactive Filter Controls */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'single', 'double', 'triple'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setSharingFilter(tier)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sharingFilter === tier
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tier === 'all' ? 'All Sharing' : tier.charAt(0).toUpperCase() + tier.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { label: 'AC & Non-AC', val: 'all' as const },
              { label: 'AC Only', val: 'true' as const },
              { label: 'Non-AC', val: 'false' as const },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setAcFilter(opt.val)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  acFilter === opt.val
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { label: 'All Wings', val: 'all' as const },
              { label: 'Female', val: 'female' as const },
              { label: 'Male', val: 'male' as const },
            ].map((g) => (
              <button
                key={g.val}
                type="button"
                onClick={() => setGenderFilter(g.val)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  genderFilter === g.val
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyAvailable((v) => !v)}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              onlyAvailable
                ? 'border-[#0f766e] bg-[#0f766e]/10 text-[#0f766e]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            Vacant Beds Only
          </button>
        </div>

        {/* Rooms Grid */}
        {roomsQuery.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="h-96 animate-pulse bg-slate-100" children={null} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              {sharingFilter === 'all' &&
              acFilter === 'all' &&
              genderFilter === 'all' &&
              !onlyAvailable
                ? 'No rooms configured yet. Sign in as owner admin to add rooms or import a dataset.'
                : 'No rooms match your current filters.'}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              {(sharingFilter !== 'all' ||
                acFilter !== 'all' ||
                genderFilter !== 'all' ||
                onlyAvailable) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSharingFilter('all');
                    setAcFilter('all');
                    setGenderFilter('all');
                    setOnlyAvailable(false);
                  }}
                >
                  Reset Filters
                </Button>
              )}
              <Link to="/dining">
                <Button variant="ghost" size="sm">
                  View Weekly Dining Menu
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room._id}
                room={room}
                isSelected={selectedCalcRoom?._id === room._id}
                onSelectForCalculator={handleSelectForCalculator}
                onBookTour={(r) =>
                  openTourModal({
                    roomId: r._id,
                    roomNumber: r.roomNumber,
                    sharingPreference: r.sharingType,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Transparent Pricing & Deposit Calculator */}
      <section id="calculator" className="pt-2">
        <PricingCalculator
          rooms={rooms}
          selectedRoom={selectedCalcRoom}
          onSelectRoom={setSelectedCalcRoom}
          onScheduleTour={(r) =>
            openTourModal({
              roomId: r._id,
              roomNumber: r.roomNumber,
              sharingPreference: r.sharingType,
            })
          }
        />
      </section>
    </div>
  );
}
