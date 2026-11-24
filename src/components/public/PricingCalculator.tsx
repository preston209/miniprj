import { useEffect, useState } from 'react';
import { Calculator, ShieldCheck, Zap } from 'lucide-react';
import { formatINR } from '../../lib/utils.ts';
import type { RoomData } from '../../types/pg.ts';
import { Button, Card, Select } from '../ui/primitives.tsx';

interface PricingCalculatorProps {
  rooms: RoomData[];
  selectedRoom: RoomData | null;
  onSelectRoom: (room: RoomData) => void;
  onScheduleTour: (room: RoomData) => void;
}

export function PricingCalculator({
  rooms,
  selectedRoom,
  onSelectRoom,
  onScheduleTour,
}: PricingCalculatorProps) {
  const activeRoom = selectedRoom ?? rooms[0] ?? null;
  const [monthlyUnits, setMonthlyUnits] = useState<number>(100);
  const [stayMonths, setStayMonths] = useState<number>(6);

  useEffect(() => {
    if (activeRoom) {
      const defaultUnits = Math.round(
        activeRoom.estimatedMonthlyElectricity /
          Math.max(1, activeRoom.electricityRatePerUnit)
      );
      setMonthlyUnits(defaultUnits);
    }
  }, [activeRoom?._id]);

  if (!activeRoom) {
    return (
      <Card className="p-6 text-sm text-slate-500">
        Pricing calculator loads once room inventory is connected.
      </Card>
    );
  }

  const estElectricity = Math.round(monthlyUnits * activeRoom.electricityRatePerUnit);
  const monthlyTotal = activeRoom.monthlyRent + estElectricity;
  const moveInTotal = activeRoom.monthlyRent + activeRoom.securityDeposit;
  const lockInNoticePenalty = stayMonths < activeRoom.lockInMonths;

  return (
    <Card className="p-6 sm:p-8">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Controls */}
        <div className="space-y-6 lg:col-span-7">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#0f766e]">
              <Calculator className="h-4 w-4" />
              <span>Transparent Cost Estimator</span>
            </div>
            <h3 className="mt-1.5 font-display text-2xl font-bold text-slate-900">
              Know every rupee before you move in
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Zero hidden brokerage fees. Sub-meter electricity is billed strictly on actual room
              consumption at ₹{activeRoom.electricityRatePerUnit}/unit.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Select Room Category
              </label>
              <Select
                value={activeRoom._id}
                onChange={(e) => {
                  const found = rooms.find((r) => r._id === e.target.value);
                  if (found) onSelectRoom(found);
                }}
              >
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    Room {r.roomNumber} · {r.sharingType.toUpperCase()} ({r.isAC ? 'AC' : 'Non-AC'}) —{' '}
                    {formatINR(r.monthlyRent)}/mo
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Planned Stay Duration ({stayMonths} months)
              </label>
              <input
                type="range"
                min={1}
                max={12}
                value={stayMonths}
                onChange={(e) => setStayMonths(Number(e.target.value))}
                className="mt-2.5 w-full accent-[#0f766e] cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400 tabular-nums">
                <span>1 mo</span>
                <span>6 mo</span>
                <span>12 mo</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                Estimated Electricity Usage (per bed / month)
              </span>
              <span className="font-mono-tabular text-slate-900">
                {monthlyUnits} units · {formatINR(estElectricity)}
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={220}
              step={5}
              value={monthlyUnits}
              onChange={(e) => setMonthlyUnits(Number(e.target.value))}
              className="mt-2 w-full accent-[#0f766e] cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>Light (Non-AC ~45u)</span>
              <span>Moderate (~100u)</span>
              <span>Heavy AC (~180u)</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Lock-in Period</p>
              <p className="mt-0.5 font-mono-tabular font-semibold text-slate-900">
                {activeRoom.lockInMonths} month{activeRoom.lockInMonths > 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Notice Period</p>
              <p className="mt-0.5 font-mono-tabular font-semibold text-slate-900">
                {activeRoom.noticePeriodDays} days
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">GST Exemption</p>
              <p className="mt-0.5 font-semibold text-emerald-700">0% (HRA Eligible)</p>
            </div>
          </div>
        </div>

        {/* Right Breakdown Summary */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-6 lg:col-span-5">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Room {activeRoom.roomNumber} · {activeRoom.sharingType.toUpperCase()} ·{' '}
              {activeRoom.isAC ? 'AC' : 'Non-AC'}
            </p>
            <h4 className="mt-1 font-display text-lg font-semibold text-slate-900">
              Monthly & Move-In Breakdown
            </h4>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Monthly Base Rent (incl. 3 meals & Wi-Fi)</dt>
                <dd className="font-mono-tabular font-medium text-slate-900">
                  {formatINR(activeRoom.monthlyRent)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">
                  Est. Sub-Meter Electricity ({monthlyUnits}u × ₹{activeRoom.electricityRatePerUnit})
                </dt>
                <dd className="font-mono-tabular font-medium text-slate-900">
                  {formatINR(estElectricity)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">Estimated Monthly Total</dt>
                <dd className="font-mono-tabular text-lg font-bold text-[#0f766e]">
                  {formatINR(monthlyTotal)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Refundable Security Deposit</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {formatINR(activeRoom.securityDeposit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Total Due at Move-In</span>
                <span className="font-mono-tabular text-base font-bold text-slate-900">
                  {formatINR(moveInTotal)}
                </span>
              </div>
            </div>

            {lockInNoticePenalty && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Note: Exiting before the {activeRoom.lockInMonths}-month lock-in forfeits 50% of
                the security deposit per house policy.
              </p>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 text-[#0f766e] shrink-0" />
              <span>100% deposit refunded within 7 working days post-checkout</span>
            </div>
            <Button className="w-full" onClick={() => onScheduleTour(activeRoom)}>
              Book a Tour for Room {activeRoom.roomNumber}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
