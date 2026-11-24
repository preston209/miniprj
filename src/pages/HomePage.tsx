import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  Clock,
  MapPin,
  Shield,
  Sparkles,
  Utensils,
  Wifi,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui/primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { GENERATED_IMAGES } from '../lib/images.ts';
import { formatINR } from '../lib/utils.ts';

export function HomePage() {
  const { openTourModal } = useAuth();
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const propertyQuery = useQuery({
    queryKey: ['property', 'primary'],
    queryFn: async () => (await api.getPrimaryProperty()).property ?? null,
    retry: false,
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms', 'overview'],
    queryFn: async () => (await api.listRooms()).rooms ?? [],
    retry: false,
  });

  const property = propertyQuery.data ?? null;
  const rooms = roomsQuery.data ?? [];

  const stats = useMemo(() => {
    const vacantTotal = rooms.reduce((sum, r) => sum + r.vacantBedsCount, 0);
    const minRent = rooms.length > 0 ? Math.min(...rooms.map((r) => r.monthlyRent)) : 9500;
    return { vacantTotal, minRent };
  }, [rooms]);

  const dbUnavailable = propertyQuery.isError || roomsQuery.isError;
  const dbErrorText =
    (propertyQuery.error instanceof Error ? propertyQuery.error.message : null) ??
    (roomsQuery.error instanceof Error ? roomsQuery.error.message : null);

  return (
    <div className="space-y-16 pb-20">
      {/* Database Setup Alert if MONGODB_URI isn't connected yet */}
      {dbUnavailable && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">MongoDB connection pending</p>
              <p className="mt-0.5 text-amber-800">
                {dbErrorText ? `${dbErrorText} ` : ''}
                Ensure <code className="font-mono-tabular">MONGODB_URI</code> is set in Settings &gt;
                Secrets and allow <code className="font-mono-tabular">0.0.0.0/0</code> in MongoDB
                Atlas Network Access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clean Empty-State Banner when DB is connected but no PG property is configured yet */}
      {!propertyQuery.isLoading && !property && !dbUnavailable && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <Card className="flex flex-col gap-4 border-teal-200 bg-teal-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-base font-bold text-slate-900">
                No PG property configured yet
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                Sign in or claim the owner admin account to add your real PG property, rooms,
                weekly menu, and rulebook documents — or import a structured JSON dataset.
              </p>
            </div>
            <Link to="/auth" className="shrink-0">
              <Button size="sm">Open Owner Setup</Button>
            </Link>
          </Card>
        </div>
      )}

      {/* Hero Split */}
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <div className="grid items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between space-y-6 lg:col-span-6 lg:py-4">
            <div className="space-y-4">
              <p className="text-sm font-medium text-[#0f766e]">
                {property
                  ? `${property.address.area}, ${property.address.city} · Managed Executive PG`
                  : 'Koramangala 4th Block, Bengaluru · Managed Executive PG'}
              </p>
              <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl [text-wrap:balance]">
                Move-in ready co-living with transparent pricing and homestyle meals
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-slate-600">
                {property?.description ??
                  'Biometric security, 300 Mbps dual-band Wi-Fi, freshly cooked Veg/Non-Veg/Jain dining, and zero-brokerage digital leases.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => openTourModal()}>
                Schedule a 1-Click Tour
              </Button>
              <Link to="/rooms">
                <Button variant="outline" size="lg">
                  Browse Live Rooms
                </Button>
              </Link>
            </div>

            {/* Proof Metrics Adjacent to Hero Claim */}
            <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
              <div>
                <p className="text-xs text-slate-500">Starting Rent</p>
                <p className="mt-0.5 font-mono-tabular text-xl font-bold text-slate-900">
                  {formatINR(stats.minRent)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Live Open Beds</p>
                <p className="mt-0.5 font-mono-tabular text-xl font-bold text-[#0f766e]">
                  {rooms.length > 0 ? stats.vacantTotal : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Deposit Refund</p>
                <p className="mt-0.5 font-mono-tabular text-xl font-bold text-slate-900">
                  {property?.houseRulesSummary?.securityDepositRefundDays ?? 7} Days
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-96 lg:h-full">
              {!heroImgFailed ? (
                <img
                  src={property?.heroImageUrl || GENERATED_IMAGES.heroLounge}
                  alt="HavenStay dining hall and co-working lounge"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-100 text-slate-500">
                  HavenStay Executive Co-Living Lounge
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full-Width Key Highlights Strip */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wifi, title: '300 Mbps Dual-Band Wi-Fi', sub: 'Mesh node on every floor' },
            { icon: Utensils, title: '3 Fresh Meals Daily', sub: 'Veg, Non-Veg & Jain kitchen' },
            { icon: Shield, title: '24/7 Biometric Access', sub: 'CCTV & digital late-entry pass' },
            {
              icon: MapPin,
              title: property?.address.landmarks?.[0] ?? '250m from Sony World',
              sub: property ? `${property.address.area}, ${property.address.city}` : '12 mins to EGL & HSR Layout',
            },
          ].map((item) => (
            <Card key={item.title} className="flex items-start gap-3.5 p-4">
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-[#0f766e]" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Dedicated Destinations: Rooms & Dining Overview Cards */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col justify-between p-6 sm:p-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[#0f766e]">
                <BedDouble className="h-4 w-4" />
                <span>Rooms &amp; Cost Estimator</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Explore Rooms &amp; Live Bed Availability
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Compare single studios, double AC suites, and triple-sharing rooms. Filter by
                gender wing or vacancy and estimate monthly rent, electricity, and deposit.
              </p>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Categories</p>
                  <p className="mt-0.5 font-mono-tabular font-semibold text-slate-900">
                    {rooms.length} Rooms
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Open Beds</p>
                  <p className="mt-0.5 font-mono-tabular font-semibold text-[#0f766e]">
                    {rooms.length > 0 ? stats.vacantTotal : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">From</p>
                  <p className="mt-0.5 font-mono-tabular font-semibold text-slate-900">
                    {formatINR(stats.minRent)}/mo
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Link to="/rooms">
                <Button className="w-full sm:w-auto">
                  <span>View Rooms &amp; Calculator</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="flex flex-col justify-between p-6 sm:p-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[#0f766e]">
                <Utensils className="h-4 w-4" />
                <span>Weekly Dining Menu</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Homestyle Veg, Non-Veg &amp; Jain Kitchen
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Browse the full Monday–Sunday breakfast, lunch, and dinner menu with dietary
                filters, serving schedules, and zero-waste meal opt-out credits.
              </p>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Breakfast</p>
                  <p className="mt-0.5 font-mono-tabular text-xs font-semibold text-slate-900">
                    {property?.mealTimings?.breakfast ?? '7:30 – 9:45 AM'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Lunch</p>
                  <p className="mt-0.5 font-mono-tabular text-xs font-semibold text-slate-900">
                    {property?.mealTimings?.lunch ?? '12:30 – 2:30 PM'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Dinner</p>
                  <p className="mt-0.5 font-mono-tabular text-xs font-semibold text-slate-900">
                    {property?.mealTimings?.dinner ?? '7:45 – 10:00 PM'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Link to="/dining">
                <Button variant="outline" className="w-full sm:w-auto">
                  <span>View Weekly Food Menu</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* House Rules Summary */}
      {property?.houseRulesSummary && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-md">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Community Standards &amp; House Policy
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  Have a specific policy question? Ask the floating{' '}
                  <span className="font-medium text-[#0f766e]">PG Concierge</span> for instant
                  verified answers cited from our rulebook.
                </p>
              </div>
              <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    Curfew &amp; Quiet Hours
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    {property.houseRulesSummary.curfewTime}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Visitor Guidelines
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    {property.houseRulesSummary.visitorHours}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <dt className="text-xs font-medium text-slate-500">Overnight Guests</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    {property.houseRulesSummary.overnightGuestPolicy}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <dt className="text-xs font-medium text-slate-500">Smoke &amp; Alcohol Policy</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    {property.houseRulesSummary.smokingAlcoholPolicy}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
