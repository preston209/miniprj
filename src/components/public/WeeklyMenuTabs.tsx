import { useState } from 'react';
import { Coffee, Moon, Sun } from 'lucide-react';
import type { DailyMenu, DayOfWeek, DietaryType, PropertyData } from '../../types/pg.ts';
import { Card } from '../ui/primitives.tsx';

const DAYS_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function DietaryTag({ dietary }: { dietary: DietaryType }) {
  if (dietary === 'veg') {
    return <span className="text-xs font-medium text-emerald-700">[Veg]</span>;
  }
  if (dietary === 'non-veg') {
    return <span className="text-xs font-medium text-red-700">[Non-Veg]</span>;
  }
  return <span className="text-xs font-medium text-amber-700">[Jain]</span>;
}

export function WeeklyMenuTabs({
  weeklyMenu,
  mealTimings,
}: {
  weeklyMenu: DailyMenu[];
  mealTimings?: PropertyData['mealTimings'];
}) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | DietaryType>('all');

  const dayMenu =
    weeklyMenu.find((m) => m.day === selectedDay) ?? weeklyMenu[0] ?? null;

  const filterItems = (items: DailyMenu['breakfast']) =>
    dietaryFilter === 'all'
      ? items
      : items.filter((item) => item.dietary === dietaryFilter);

  if (!dayMenu) {
    return null;
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Mon-Sun Day Tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {DAYS_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedDay === day
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Dietary Filter Segmented Control */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start lg:self-auto">
          {(['all', 'veg', 'non-veg', 'jain'] as const).map((diet) => (
            <button
              key={diet}
              type="button"
              onClick={() => setDietaryFilter(diet)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dietaryFilter === diet
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {diet === 'all'
                ? 'All Meals'
                : diet === 'veg'
                ? 'Veg'
                : diet === 'non-veg'
                ? 'Non-Veg'
                : 'Jain'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {/* Breakfast */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
              <Coffee className="h-4 w-4 text-[#0f766e]" />
              Breakfast
            </h4>
            <span className="font-mono-tabular text-xs text-slate-500">
              {mealTimings?.breakfast ?? '7:30 – 9:45 AM'}
            </span>
          </div>
          <ul className="space-y-2.5 border-t border-slate-100 pt-3">
            {filterItems(dayMenu.breakfast).map((item, idx) => (
              <li
                key={idx}
                className="flex items-start justify-between gap-2 text-sm text-slate-700"
              >
                <span>{item.name}</span>
                <DietaryTag dietary={item.dietary} />
              </li>
            ))}
            {filterItems(dayMenu.breakfast).length === 0 && (
              <li className="text-xs text-slate-400">No items match this filter.</li>
            )}
          </ul>
        </div>

        {/* Lunch */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
              <Sun className="h-4 w-4 text-amber-600" />
              Lunch
            </h4>
            <span className="font-mono-tabular text-xs text-slate-500">
              {mealTimings?.lunch ?? '12:30 – 2:30 PM'}
            </span>
          </div>
          <ul className="space-y-2.5 border-t border-slate-100 pt-3">
            {filterItems(dayMenu.lunch).map((item, idx) => (
              <li
                key={idx}
                className="flex items-start justify-between gap-2 text-sm text-slate-700"
              >
                <span>{item.name}</span>
                <DietaryTag dietary={item.dietary} />
              </li>
            ))}
            {filterItems(dayMenu.lunch).length === 0 && (
              <li className="text-xs text-slate-400">No items match this filter.</li>
            )}
          </ul>
        </div>

        {/* Dinner */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
              <Moon className="h-4 w-4 text-slate-700" />
              Dinner
            </h4>
            <span className="font-mono-tabular text-xs text-slate-500">
              {mealTimings?.dinner ?? '7:45 – 10:00 PM'}
            </span>
          </div>
          <ul className="space-y-2.5 border-t border-slate-100 pt-3">
            {filterItems(dayMenu.dinner).map((item, idx) => (
              <li
                key={idx}
                className="flex items-start justify-between gap-2 text-sm text-slate-700"
              >
                <span>{item.name}</span>
                <DietaryTag dietary={item.dietary} />
              </li>
            ))}
            {filterItems(dayMenu.dinner).length === 0 && (
              <li className="text-xs text-slate-400">No items match this filter.</li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}
