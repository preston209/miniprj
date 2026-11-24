import { useState } from 'react';
import { BedDouble, CheckCircle2, Clock } from 'lucide-react';
import { resolveRoomImage } from '../../lib/images.ts';
import { formatINR } from '../../lib/utils.ts';
import type { RoomData } from '../../types/pg.ts';
import { Button, Card } from '../ui/primitives.tsx';

interface RoomCardProps {
  room: RoomData;
  isSelected?: boolean;
  onSelectForCalculator: (room: RoomData) => void;
  onBookTour: (room: RoomData) => void;
}

export function RoomCard({
  room,
  isSelected,
  onSelectForCalculator,
  onBookTour,
}: RoomCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = resolveRoomImage(room.sharingType, room.imageUrl);
  const sharingLabel =
    room.sharingType === 'single'
      ? 'Single Studio'
      : room.sharingType === 'double'
      ? 'Double Sharing'
      : 'Triple Sharing';

  const genderLabel =
    room.genderPreference === 'any'
      ? 'Any Gender'
      : room.genderPreference === 'female'
      ? 'Female Wing'
      : 'Male Wing';

  return (
    <Card
      className={`overflow-hidden transition-colors duration-150 ${
        isSelected ? 'border-[#0f766e] ring-1 ring-[#0f766e]' : 'hover:border-slate-300'
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {!imgFailed ? (
          <img
            src={imgSrc}
            alt={`Room ${room.roomNumber} ${sharingLabel}`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 text-slate-500">
            <BedDouble className="h-10 w-10 text-slate-400" />
            <span className="mt-2 text-sm font-medium">
              Room {room.roomNumber} · {sharingLabel}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Room {room.roomNumber} · Floor {room.floor} · {room.isAC ? 'AC' : 'Non-AC'} ·{' '}
              {genderLabel}
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-slate-900">
              {sharingLabel}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono-tabular text-lg font-semibold text-slate-900">
              {formatINR(room.monthlyRent)}
            </p>
            <p className="text-xs text-slate-500">per bed / mo</p>
          </div>
        </div>

        {room.description && (
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600 line-clamp-2">
            {room.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
          <span>Deposit {formatINR(room.securityDeposit)}</span>
          <span aria-hidden="true">·</span>
          <span>{room.lockInMonths} mo lock-in</span>
          <span aria-hidden="true">·</span>
          <span>{room.noticePeriodDays}d notice</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {room.vacantBedsCount > 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 tabular-nums">
                  {room.vacantBedsCount} of {room.totalBeds} bed
                  {room.totalBeds > 1 ? 's' : ''} open
                </span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-700">Waitlist only</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectForCalculator(room)}
          >
            Estimate Cost
          </Button>
          <Button size="sm" onClick={() => onBookTour(room)}>
            Book Tour
          </Button>
        </div>
      </div>
    </Card>
  );
}
