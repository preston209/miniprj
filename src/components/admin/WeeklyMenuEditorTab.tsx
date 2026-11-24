import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type {
  DailyMenu,
  DayOfWeek,
  DietaryType,
  PropertyData,
} from '../../types/pg.ts';
import { Button, Card, Input, Select } from '../ui/primitives.tsx';

const ALL_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function WeeklyMenuEditorTab({ property }: { property: PropertyData | null }) {
  const queryClient = useQueryClient();

  const [menuDay, setMenuDay] = useState<DayOfWeek>('Monday');
  const [newMealSlot, setNewMealSlot] = useState<'breakfast' | 'lunch' | 'dinner'>('dinner');
  const [newDishName, setNewDishName] = useState('');
  const [newDishDietary, setNewDishDietary] = useState<DietaryType>('veg');

  const [breakfastTime, setBreakfastTime] = useState('7:30 AM – 9:45 AM');
  const [lunchTime, setLunchTime] = useState('12:30 PM – 2:30 PM');
  const [dinnerTime, setDinnerTime] = useState('7:45 PM – 10:00 PM');
  const [menuNotice, setMenuNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (property?.mealTimings) {
      setBreakfastTime(property.mealTimings.breakfast);
      setLunchTime(property.mealTimings.lunch);
      setDinnerTime(property.mealTimings.dinner);
    }
  }, [property]);

  const updateMenuMutation = useMutation({
    mutationFn: ({
      propertyId,
      weeklyMenu,
      mealTimings,
    }: {
      propertyId: string;
      weeklyMenu: DailyMenu[];
      mealTimings?: PropertyData['mealTimings'];
    }) => api.updateWeeklyMenu(propertyId, weeklyMenu, mealTimings),
    onSuccess: (res) => {
      setNewDishName('');
      setMenuNotice({ type: 'ok', text: res.message });
      queryClient.invalidateQueries({ queryKey: ['property', 'primary'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
    },
    onError: (err) => {
      setMenuNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update weekly menu.',
      });
    },
  });

  if (!property) {
    return (
      <Card className="p-8 text-sm text-slate-500">
        Create or import a PG property in the <strong>Property &amp; Import</strong> tab first to
        manage its weekly dining menu.
      </Card>
    );
  }

  // Ensure all 7 days exist cleanly even if a property started with partial days
  const normalizedWeeklyMenu: DailyMenu[] = ALL_DAYS.map((day) => {
    const existing = property.weeklyMenu.find((m) => m.day === day);
    return existing ?? { day, breakfast: [], lunch: [], dinner: [] };
  });

  const activeDayMenu =
    normalizedWeeklyMenu.find((m) => m.day === menuDay) ?? normalizedWeeklyMenu[0];

  const currentTimings = {
    breakfast: breakfastTime.trim() || '7:30 AM – 9:45 AM',
    lunch: lunchTime.trim() || '12:30 PM – 2:30 PM',
    dinner: dinnerTime.trim() || '7:45 PM – 10:00 PM',
  };

  const handleSaveTimings = (e: React.FormEvent) => {
    e.preventDefault();
    setMenuNotice(null);
    updateMenuMutation.mutate({
      propertyId: property._id,
      weeklyMenu: normalizedWeeklyMenu,
      mealTimings: currentTimings,
    });
  };

  const handleAddMenuDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim()) return;
    setMenuNotice(null);
    const updatedMenu = normalizedWeeklyMenu.map((dayObj) => {
      if (dayObj.day !== menuDay) return dayObj;
      return {
        ...dayObj,
        [newMealSlot]: [
          ...dayObj[newMealSlot],
          { name: newDishName.trim(), dietary: newDishDietary },
        ],
      };
    });
    updateMenuMutation.mutate({
      propertyId: property._id,
      weeklyMenu: updatedMenu,
      mealTimings: currentTimings,
    });
  };

  const handleRemoveMenuDish = (slot: 'breakfast' | 'lunch' | 'dinner', idx: number) => {
    setMenuNotice(null);
    const updatedMenu = normalizedWeeklyMenu.map((dayObj) => {
      if (dayObj.day !== menuDay) return dayObj;
      return {
        ...dayObj,
        [slot]: dayObj[slot].filter((_, i) => i !== idx),
      };
    });
    updateMenuMutation.mutate({
      propertyId: property._id,
      weeklyMenu: updatedMenu,
      mealTimings: currentTimings,
    });
  };

  return (
    <div className="space-y-6">
      {menuNotice && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            menuNotice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {menuNotice.text}
        </div>
      )}

      {/* Meal Timings Configurator */}
      <Card className="p-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Clock className="h-4 w-4 text-[#0f766e]" />
          <h3 className="font-display text-base font-bold text-slate-900">Dining Timings</h3>
        </div>
        <form onSubmit={handleSaveTimings} className="mt-4 grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700">Breakfast</label>
            <Input
              value={breakfastTime}
              onChange={(e) => setBreakfastTime(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700">Lunch</label>
            <Input value={lunchTime} onChange={(e) => setLunchTime(e.target.value)} required />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700">Dinner</label>
            <Input value={dinnerTime} onChange={(e) => setDinnerTime(e.target.value)} required />
          </div>
          <div className="flex items-end sm:col-span-3">
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={updateMenuMutation.isPending}
            >
              Save Timings & Sync
            </Button>
          </div>
        </form>
      </Card>

      {/* Mon-Sun Menu Items */}
      <Card className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Weekly Menu Manager
            </h2>
            <p className="text-xs text-slate-500">
              Updates save directly to MongoDB and auto-re-embed into AI Concierge knowledge chunks.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {ALL_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setMenuDay(day)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  menuDay === day ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAddMenuDish} className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <Select
              value={newMealSlot}
              onChange={(e) =>
                setNewMealSlot(e.target.value as 'breakfast' | 'lunch' | 'dinner')
              }
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </Select>
          </div>
          <div className="sm:col-span-5">
            <Input
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              placeholder="Add dish name (e.g., Methi Paratha & Curd)"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Select
              value={newDishDietary}
              onChange={(e) => setNewDishDietary(e.target.value as DietaryType)}
            >
              <option value="veg">Veg</option>
              <option value="non-veg">Non-Veg</option>
              <option value="jain">Jain</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={updateMenuMutation.isPending}>
              Add Dish
            </Button>
          </div>
        </form>

        <div className="grid gap-6 md:grid-cols-3">
          {(['breakfast', 'lunch', 'dinner'] as const).map((slot) => (
            <div key={slot} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold capitalize text-slate-900">
                  {slot}
                </h3>
                <span className="font-mono-tabular text-[11px] text-slate-500">
                  {currentTimings[slot]}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {activeDayMenu[slot].map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 text-xs text-slate-700"
                  >
                    <span>
                      {item.name} <strong className="text-slate-500">[{item.dietary}]</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMenuDish(slot, idx)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label="Remove dish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {activeDayMenu[slot].length === 0 && (
                  <li className="text-xs text-slate-400">No items added for {menuDay}.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
