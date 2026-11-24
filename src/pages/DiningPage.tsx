import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Coffee, Leaf, Moon, Sun, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WeeklyMenuTabs } from '../components/public/WeeklyMenuTabs.tsx';
import { Button, Card } from '../components/ui/primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';

export function DiningPage() {
  const { user, openTourModal } = useAuth();

  const propertyQuery = useQuery({
    queryKey: ['property', 'primary'],
    queryFn: async () => (await api.getPrimaryProperty()).property ?? null,
    retry: false,
  });

  const property = propertyQuery.data ?? null;
  const timings = {
    breakfast: property?.mealTimings?.breakfast ?? '7:30 AM – 9:45 AM',
    lunch: property?.mealTimings?.lunch ?? '12:30 PM – 2:30 PM',
    dinner: property?.mealTimings?.dinner ?? '7:45 PM – 10:00 PM',
  };

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[#0f766e]">
            {property
              ? `${property.name} · Homestyle Kitchen`
              : 'Homestyle Dining · Veg, Non-Veg & Jain'}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
            Weekly Homestyle Dining Menu
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            Three freshly cooked meals daily with dedicated Vegetarian, Non-Vegetarian, and Jain
            counters. Residents can opt out of upcoming meals up to 4 hours ahead to reduce food
            waste.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link to="/rooms">
            <Button variant="outline" size="sm">
              Browse Rooms
            </Button>
          </Link>
          <Button size="sm" onClick={() => openTourModal()}>
            Schedule Tour
          </Button>
        </div>
      </div>

      {propertyQuery.isError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Unable to load dining schedule</p>
            <p className="mt-0.5 text-amber-800">
              {propertyQuery.error instanceof Error
                ? propertyQuery.error.message
                : 'Database connection pending.'}
            </p>
          </div>
        </div>
      )}

      {/* Serving Schedule Strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-start gap-3.5 p-5">
          <Coffee className="mt-0.5 h-5 w-5 shrink-0 text-[#0f766e]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Breakfast</p>
            <p className="mt-0.5 font-mono-tabular text-xs font-medium text-slate-700">
              {timings.breakfast}
            </p>
            <p className="mt-1 text-xs text-slate-500">South &amp; North Indian hot breakfast + tea/coffee</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3.5 p-5">
          <Sun className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Lunch</p>
            <p className="mt-0.5 font-mono-tabular text-xs font-medium text-slate-700">
              {timings.lunch}
            </p>
            <p className="mt-1 text-xs text-slate-500">Tiffin packing available for office commuters</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3.5 p-5">
          <Moon className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Dinner</p>
            <p className="mt-0.5 font-mono-tabular text-xs font-medium text-slate-700">
              {timings.dinner}
            </p>
            <p className="mt-1 text-xs text-slate-500">Fresh rotis, dal, seasonal sabzi &amp; protein specials</p>
          </div>
        </Card>
      </section>

      {/* Interactive Weekly Menu */}
      <section>
        {propertyQuery.isLoading ? (
          <Card className="h-80 animate-pulse bg-slate-100" children={null} />
        ) : property?.weeklyMenu && property.weeklyMenu.length > 0 ? (
          <WeeklyMenuTabs
            weeklyMenu={property.weeklyMenu}
            mealTimings={property.mealTimings}
          />
        ) : (
          <Card className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Weekly dining menu has not been configured yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Owners can configure Monday–Sunday dishes and meal timings in the Admin Dashboard.
            </p>
            {user?.role === 'admin' && (
              <Link to="/admin" className="mt-4 inline-block">
                <Button size="sm">Open Weekly Menu Editor</Button>
              </Link>
            )}
          </Card>
        )}
      </section>

      {/* Kitchen Standards & Meal Opt-Out Callout */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-[#0f766e]">
            <Leaf className="h-5 w-5" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Separate Veg, Non-Veg &amp; Jain Counters
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Jain meals are prepared strictly without onion, garlic, or root vegetables using
            dedicated utensils. Non-vegetarian curries and eggs are cooked and served from a
            separate counter.
          </p>
        </Card>

        <Card className="flex flex-col justify-between space-y-4 p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#0f766e]">
              <UtensilsCrossed className="h-5 w-5" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Zero-Waste Meal Opt-Out Credits
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Traveling or dining out? Residents can toggle off upcoming meals at least 4 hours
              before service in the Resident Portal to earn a{' '}
              <span className="font-mono-tabular font-semibold text-slate-900">₹45/meal</span>{' '}
              credit on their monthly rent invoice.
            </p>
          </div>
          <div>
            <Link to={user ? '/resident' : '/auth'}>
              <Button variant="outline" size="sm">
                {user ? 'Manage Meal Opt-Outs in Portal' : 'Resident Sign In'}
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
