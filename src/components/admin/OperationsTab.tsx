import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, UserPlus, Wrench } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { formatShortDate } from '../../lib/utils.ts';
import type { TicketData, TourBookingData } from '../../types/pg.ts';
import { Button, Card, Select } from '../ui/primitives.tsx';
import type { OnboardPrefill } from './OnboardResidentModal.tsx';

type TourStatus = 'pending' | 'confirmed' | 'completed' | 'converted_to_resident' | 'cancelled';

interface OperationsTabProps {
  tickets: TicketData[];
  tours: TourBookingData[];
  hasAvailableBed: boolean;
  onConvertTourToResident: (prefill: OnboardPrefill) => void;
}

export function OperationsTab({
  tickets,
  tours,
  hasAvailableBed,
  onConvertTourToResident,
}: OperationsTabProps) {
  const queryClient = useQueryClient();
  const [tourFilter, setTourFilter] = useState<'all' | TourStatus>('all');
  const [opNotice, setOpNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const updateTicketMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof api.updateTicket>[1];
    }) => api.updateTicket(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });

  const updateTourMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TourStatus }) =>
      api.updateTourStatus(id, { status }),
    onSuccess: (res) => {
      setOpNotice({ type: 'ok', text: res.message });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tours'] });
    },
    onError: (err) => {
      setOpNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update tour status.',
      });
    },
  });

  const filteredTours =
    tourFilter === 'all' ? tours : tours.filter((t) => t.status === tourFilter);

  return (
    <div className="space-y-4">
      {opNotice && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            opNotice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {opNotice.text}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Tour Requests & Lead Conversion */}
        <Card className="p-6 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#0f766e]" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Tour Requests ({filteredTours.length})
              </h2>
            </div>

            <Select
              className="h-9 w-44 text-xs"
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value as 'all' | TourStatus)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="converted_to_resident">Converted to Resident</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {filteredTours.map((tour) => {
              const isConverted = tour.status === 'converted_to_resident';
              const isCancelled = tour.status === 'cancelled';

              return (
                <div key={tour._id} className="space-y-2.5 py-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {tour.leadName}{' '}
                        <span className="ml-1.5 text-xs font-medium text-[#0f766e]">
                          {tour.tourMode.toUpperCase()}
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono-tabular text-xs text-slate-600">
                        {formatShortDate(tour.tourSlotDate)} · {tour.tourSlotTime}
                        {tour.roomId?.roomNumber ? ` · Room ${tour.roomId.roomNumber}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {tour.leadPhone} · {tour.leadEmail}
                        {tour.sharingPreference ? ` · Prefers ${tour.sharingPreference}` : ''}
                      </p>
                      {tour.notes && (
                        <p className="mt-1 text-xs text-slate-600">Note: {tour.notes}</p>
                      )}
                    </div>

                    <Select
                      className="h-8 w-44 text-xs"
                      value={tour.status}
                      disabled={updateTourMutation.isPending}
                      onChange={(e) =>
                        updateTourMutation.mutate({
                          id: tour._id,
                          status: e.target.value as TourStatus,
                        })
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="converted_to_resident">Converted to Resident</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  </div>

                  {!isConverted && !isCancelled && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!hasAvailableBed}
                        onClick={() =>
                          onConvertTourToResident({
                            name: tour.leadName,
                            email: tour.leadEmail,
                            phone: tour.leadPhone,
                            tourBookingId: tour._id,
                          })
                        }
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {hasAvailableBed ? 'Convert to Resident' : 'No Vacant Bed'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredTours.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No tour requests match this filter.
              </p>
            )}
          </div>
        </Card>

        {/* Maintenance Queue */}
        <Card className="p-6 lg:col-span-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Wrench className="h-4 w-4 text-[#0f766e]" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Maintenance Queue ({tickets.length})
            </h2>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {tickets.map((t) => (
              <div key={t._id} className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      Room {t.roomId?.roomNumber ?? '—'} · {t.residentId?.name ?? 'Resident'} ·{' '}
                      {t.category} · {t.priority.toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{t.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{t.description}</p>
                  </div>
                  <Select
                    className="h-8 w-36 shrink-0 text-xs"
                    value={t.status}
                    onChange={(e) =>
                      updateTicketMutation.mutate({
                        id: t._id,
                        payload: { status: e.target.value as TicketData['status'] },
                      })
                    }
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </Select>
                </div>
              </div>
            ))}
            {tickets.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No maintenance tickets open.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
