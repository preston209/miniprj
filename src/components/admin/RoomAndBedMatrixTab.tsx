import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { formatINR, formatShortDate } from '../../lib/utils.ts';
import type {
  BedMatrixItem,
  GenderPreference,
  PropertyData,
  RoomData,
  SharingType,
  UserProfile,
} from '../../types/pg.ts';
import { Button, Card, Input, Select, Textarea } from '../ui/primitives.tsx';

interface RoomAndBedMatrixTabProps {
  property: PropertyData | null;
  rooms: RoomData[];
  beds: BedMatrixItem[];
  residents: UserProfile[];
  onOpenOnboard: (prefill?: { bedId?: string }) => void;
}

export function RoomAndBedMatrixTab({
  property,
  rooms,
  beds,
  residents,
  onOpenOnboard,
}: RoomAndBedMatrixTabProps) {
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Bed Allocation Modal
  const [editingBed, setEditingBed] = useState<BedMatrixItem | null>(null);
  const [bedStatus, setBedStatus] = useState<BedMatrixItem['status']>('available');
  const [bedTenantId, setBedTenantId] = useState('');
  const [bedVacateDate, setBedVacateDate] = useState('');
  const [bedNotes, setBedNotes] = useState('');

  // Room Create / Edit Modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomData | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [floor, setFloor] = useState(1);
  const [sharingType, setSharingType] = useState<SharingType>('double');
  const [isAC, setIsAC] = useState(true);
  const [genderPreference, setGenderPreference] = useState<GenderPreference>('any');
  const [monthlyRent, setMonthlyRent] = useState(14000);
  const [securityDeposit, setSecurityDeposit] = useState(20000);
  const [lockInMonths, setLockInMonths] = useState(2);
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [electricityRate, setElectricityRate] = useState(9);
  const [estElectricity, setEstElectricity] = useState(900);
  const [roomAmenities, setRoomAmenities] = useState('Split AC, Wardrobe, Study Desk');
  const [roomImageUrl, setRoomImageUrl] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'beds'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'residents'] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
  };

  const allocateMutation = useMutation({
    mutationFn: ({
      bedId,
      payload,
    }: {
      bedId: string;
      payload: Parameters<typeof api.allocateBed>[1];
    }) => api.allocateBed(bedId, payload),
    onSuccess: (res) => {
      setEditingBed(null);
      setNotice({ type: 'ok', text: res.message });
      invalidateInventory();
    },
    onError: (err) => {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update bed allocation.',
      });
    },
  });

  const saveRoomMutation = useMutation({
    mutationFn: async () => {
      const parsedAmenities = roomAmenities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingRoom) {
        return api.updateRoom(editingRoom._id, {
          roomNumber: roomNumber.trim(),
          floor: Number(floor),
          isAC,
          genderPreference,
          monthlyRent: Number(monthlyRent),
          securityDeposit: Number(securityDeposit),
          lockInMonths: Number(lockInMonths),
          noticePeriodDays: Number(noticePeriodDays),
          electricityRatePerUnit: Number(electricityRate),
          estimatedMonthlyElectricity: Number(estElectricity),
          amenities: parsedAmenities,
          ...(roomImageUrl.trim() ? { imageUrl: roomImageUrl.trim() } : {}),
          ...(roomDesc.trim() ? { description: roomDesc.trim() } : {}),
        });
      }

      if (!property) {
        throw new Error('Create a PG Property first in the Property & Import tab.');
      }

      return api.createRoom({
        propertyId: property._id,
        roomNumber: roomNumber.trim(),
        floor: Number(floor),
        sharingType,
        isAC,
        genderPreference,
        monthlyRent: Number(monthlyRent),
        securityDeposit: Number(securityDeposit),
        lockInMonths: Number(lockInMonths),
        noticePeriodDays: Number(noticePeriodDays),
        electricityRatePerUnit: Number(electricityRate),
        estimatedMonthlyElectricity: Number(estElectricity),
        amenities: parsedAmenities,
        ...(roomImageUrl.trim() ? { imageUrl: roomImageUrl.trim() } : {}),
        ...(roomDesc.trim() ? { description: roomDesc.trim() } : {}),
      });
    },
    onSuccess: (res) => {
      setRoomModalOpen(false);
      setEditingRoom(null);
      setNotice({ type: 'ok', text: res.message });
      invalidateInventory();
    },
    onError: (err) => {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save room.',
      });
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: api.deleteRoom,
    onSuccess: (res) => {
      setConfirmDeleteRoomId(null);
      setNotice({ type: 'ok', text: res.message });
      invalidateInventory();
    },
    onError: (err) => {
      setConfirmDeleteRoomId(null);
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to delete room.',
      });
    },
  });

  const roomCards = useMemo(() => {
    const bedsMap = new Map<string, BedMatrixItem[]>();
    for (const bed of beds) {
      const rId = bed.roomId?._id;
      if (!rId) continue;
      const list = bedsMap.get(rId) ?? [];
      list.push(bed);
      bedsMap.set(rId, list);
    }

    return rooms.map((room) => ({
      room,
      beds: bedsMap.get(room._id) ?? [],
    }));
  }, [rooms, beds]);

  const openCreateRoom = () => {
    setEditingRoom(null);
    setRoomNumber('');
    setFloor(1);
    setSharingType('double');
    setIsAC(true);
    setGenderPreference('any');
    setMonthlyRent(14000);
    setSecurityDeposit(20000);
    setLockInMonths(2);
    setNoticePeriodDays(30);
    setElectricityRate(property?.electricityRatePerUnit ?? 9);
    setEstElectricity(900);
    setRoomAmenities('Split AC, Wardrobe, Study Desk');
    setRoomImageUrl('');
    setRoomDesc('');
    setRoomModalOpen(true);
  };

  const openEditRoom = (room: RoomData) => {
    setEditingRoom(room);
    setRoomNumber(room.roomNumber);
    setFloor(room.floor);
    setSharingType(room.sharingType);
    setIsAC(room.isAC);
    setGenderPreference(room.genderPreference);
    setMonthlyRent(room.monthlyRent);
    setSecurityDeposit(room.securityDeposit);
    setLockInMonths(room.lockInMonths);
    setNoticePeriodDays(room.noticePeriodDays);
    setElectricityRate(room.electricityRatePerUnit);
    setEstElectricity(room.estimatedMonthlyElectricity);
    setRoomAmenities((room.amenities ?? []).join(', '));
    setRoomImageUrl(room.imageUrl ?? '');
    setRoomDesc(room.description ?? '');
    setRoomModalOpen(true);
  };

  const handleOpenBedModal = (bed: BedMatrixItem) => {
    setEditingBed(bed);
    setBedStatus(bed.status);
    setBedTenantId(bed.currentTenantId?._id ?? '');
    setBedVacateDate(bed.expectedVacateDate ? bed.expectedVacateDate.slice(0, 10) : '');
    setBedNotes(bed.notes ?? '');
  };

  const handleSaveBed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBed) return;
    allocateMutation.mutate({
      bedId: editingBed._id,
      payload: {
        status: bedStatus,
        tenantId:
          bedStatus === 'occupied' || bedStatus === 'notice_period' || bedStatus === 'reserved'
            ? bedTenantId || null
            : null,
        expectedVacateDate: bedVacateDate ? new Date(bedVacateDate).toISOString() : null,
        notes: bedNotes.trim(),
      },
    });
  };

  const vacantTotal = beds.filter((b) => b.status === 'available').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Rooms & Bed Allocation Matrix
          </h2>
          <p className="text-xs text-slate-500">
            <span className="font-mono-tabular font-semibold text-slate-900">{rooms.length}</span>{' '}
            active rooms ·{' '}
            <span className="font-mono-tabular font-semibold text-[#0f766e]">{vacantTotal}</span>{' '}
            vacant beds · Edits trigger immediate RAG vector sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenOnboard()}>
            <UserPlus className="h-4 w-4" />
            Onboard Resident
          </Button>
          <Button size="sm" onClick={openCreateRoom} disabled={!property}>
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
        </div>
      </div>

      {!property && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
          Create a PG Property (or import a JSON dataset) in the <strong>Property &amp; Import</strong>{' '}
          tab before adding rooms.
        </Card>
      )}

      {notice && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roomCards.map(({ room, beds: roomBeds }) => (
          <Card key={room._id} className="p-5">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Room {room.roomNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Floor {room.floor} · {room.sharingType.toUpperCase()} ·{' '}
                  {room.isAC ? 'AC' : 'Non-AC'} ·{' '}
                  {room.genderPreference === 'any'
                    ? 'Any'
                    : room.genderPreference.toUpperCase()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono-tabular text-sm font-semibold text-slate-900">
                  {formatINR(room.monthlyRent)}
                </p>
                <p className="font-mono-tabular text-[11px] text-slate-500">
                  Dep {formatINR(room.securityDeposit)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <span className="font-mono-tabular text-slate-600">
                {room.vacantBedsCount} / {room.totalBeds} vacant
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditRoom(room)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                {confirmDeleteRoomId === room._id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={deleteRoomMutation.isPending}
                      onClick={() => deleteRoomMutation.mutate(room._id)}
                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRoomId(null)}
                      className="rounded-md px-1.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteRoomId(room._id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    aria-label={`Delete room ${room.roomNumber}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              {roomBeds.map((bed) => (
                <div
                  key={bed._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-mono-tabular text-xs font-bold text-slate-900">
                      {bed.bedCode} ·{' '}
                      <span
                        className={
                          bed.status === 'available'
                            ? 'text-emerald-700'
                            : bed.status === 'occupied'
                            ? 'text-slate-700'
                            : bed.status === 'notice_period'
                            ? 'text-amber-700'
                            : bed.status === 'reserved'
                            ? 'text-[#0f766e]'
                            : 'text-red-700'
                        }
                      >
                        {bed.status === 'notice_period'
                          ? 'NOTICE PERIOD'
                          : bed.status.toUpperCase()}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {bed.currentTenantId?.name ?? 'Unassigned'}
                      {bed.expectedVacateDate
                        ? ` · Vacates ${formatShortDate(bed.expectedVacateDate)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {bed.status === 'available' && (
                      <Button
                        size="sm"
                        onClick={() => onOpenOnboard({ bedId: bed._id })}
                      >
                        Onboard
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenBedModal(bed)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Bed Allocation Modal */}
      {editingBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <Card className="w-full max-w-md p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Allocate Bed {editingBed.bedCode}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Changes automatically recalculate room vacancy and sync to AI vector search.
            </p>

            <form onSubmit={handleSaveBed} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Bed Status
                </label>
                <Select
                  value={bedStatus}
                  onChange={(e) => setBedStatus(e.target.value as BedMatrixItem['status'])}
                >
                  <option value="available">Available (Vacant)</option>
                  <option value="occupied">Occupied</option>
                  <option value="notice_period">Notice Period (Vacating Soon)</option>
                  <option value="reserved">Reserved</option>
                  <option value="maintenance">Maintenance Block</option>
                </Select>
              </div>

              {(bedStatus === 'occupied' ||
                bedStatus === 'notice_period' ||
                bedStatus === 'reserved') && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Assign Resident / Tenant
                  </label>
                  <Select
                    value={bedTenantId}
                    onChange={(e) => setBedTenantId(e.target.value)}
                  >
                    <option value="">-- Select User --</option>
                    {residents.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {(bedStatus === 'occupied' || bedStatus === 'notice_period') && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {bedStatus === 'notice_period'
                      ? 'Expected Vacate Date'
                      : 'Notice / Expected Vacate Date (Optional)'}
                  </label>
                  <Input
                    type="date"
                    value={bedVacateDate}
                    onChange={(e) => setBedVacateDate(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Notes (Optional)
                </label>
                <Input
                  value={bedNotes}
                  onChange={(e) => setBedNotes(e.target.value)}
                  placeholder="Window bed, biometric sync pending..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingBed(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={allocateMutation.isPending}>
                  {allocateMutation.isPending ? 'Syncing...' : 'Save Allocation'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Create / Edit Room Modal */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <Card className="my-8 w-full max-w-xl p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Create New Room'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingRoom
                    ? 'Updates pricing/terms and immediately syncs room inventory to RAG.'
                    : 'Auto-generates individual beds (A/B/C) and embeds room inventory for AI Concierge.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                aria-label="Close room modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveRoomMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Room Number
                  </label>
                  <Input
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="204"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Floor</label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Sharing Type
                  </label>
                  <Select
                    value={sharingType}
                    disabled={Boolean(editingRoom)}
                    onChange={(e) => setSharingType(e.target.value as SharingType)}
                  >
                    <option value="single">Single (1 Bed)</option>
                    <option value="double">Double (2 Beds)</option>
                    <option value="triple">Triple (3 Beds)</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Air Conditioning
                  </label>
                  <Select
                    value={isAC ? 'true' : 'false'}
                    onChange={(e) => setIsAC(e.target.value === 'true')}
                  >
                    <option value="true">AC Room</option>
                    <option value="false">Non-AC Room</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Gender Wing
                  </label>
                  <Select
                    value={genderPreference}
                    onChange={(e) => setGenderPreference(e.target.value as GenderPreference)}
                  >
                    <option value="any">Any / Co-Ed</option>
                    <option value="female">Female Only</option>
                    <option value="male">Male Only</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Monthly Rent (₹)
                  </label>
                  <Input
                    type="number"
                    min={1000}
                    max={200000}
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Deposit (₹)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={500000}
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Lock-in (Mo)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={lockInMonths}
                    onChange={(e) => setLockInMonths(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Notice (Days)
                  </label>
                  <Input
                    type="number"
                    min={7}
                    max={90}
                    value={noticePeriodDays}
                    onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Elec (₹/unit)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    value={electricityRate}
                    onChange={(e) => setElectricityRate(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Est. Monthly Electricity (₹)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={20000}
                    value={estElectricity}
                    onChange={(e) => setEstElectricity(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Image URL (Optional)
                  </label>
                  <Input
                    value={roomImageUrl}
                    onChange={(e) => setRoomImageUrl(e.target.value)}
                    placeholder="/src/assets/images/... or https://..."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Amenities (comma-separated)
                </label>
                <Input
                  value={roomAmenities}
                  onChange={(e) => setRoomAmenities(e.target.value)}
                  placeholder="Split AC, Work Desk, Attached Balcony"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Description (Optional)
                </label>
                <Textarea
                  rows={2}
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="Spacious corner room with natural light..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRoomModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveRoomMutation.isPending}>
                  {saveRoomMutation.isPending
                    ? 'Saving & Syncing...'
                    : editingRoom
                    ? 'Save Room Changes'
                    : 'Create Room & Beds'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
