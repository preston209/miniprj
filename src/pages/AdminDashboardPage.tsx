import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BedDouble,
  BookOpen,
  Building2,
  Utensils,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { KnowledgeBaseTab } from '../components/admin/KnowledgeBaseTab.tsx';
import {
  OnboardResidentModal,
  type OnboardPrefill,
} from '../components/admin/OnboardResidentModal.tsx';
import { OperationsTab } from '../components/admin/OperationsTab.tsx';
import { PropertyAndImportTab } from '../components/admin/PropertyAndImportTab.tsx';
import { RoomAndBedMatrixTab } from '../components/admin/RoomAndBedMatrixTab.tsx';
import { WeeklyMenuEditorTab } from '../components/admin/WeeklyMenuEditorTab.tsx';
import { Button, Card } from '../components/ui/primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';

type AdminTab = 'matrix' | 'property' | 'operations' | 'menu' | 'knowledge';

export function AdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('matrix');
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardPrefill, setOnboardPrefill] = useState<OnboardPrefill | null>(null);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const propertyQuery = useQuery({
    queryKey: ['property', 'primary'],
    queryFn: async () => (await api.getPrimaryProperty()).property ?? null,
    enabled: Boolean(isAdmin),
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms', 'admin'],
    queryFn: async () => (await api.listRooms()).rooms ?? [],
    enabled: Boolean(isAdmin),
  });

  const bedsQuery = useQuery({
    queryKey: ['admin', 'beds'],
    queryFn: async () => (await api.getBedMatrix()).beds ?? [],
    enabled: Boolean(isAdmin),
  });

  const residentsQuery = useQuery({
    queryKey: ['admin', 'residents'],
    queryFn: async () => (await api.listResidents()).residents ?? [],
    enabled: Boolean(isAdmin),
  });

  const ticketsQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => (await api.listTickets()).tickets ?? [],
    enabled: Boolean(isAdmin),
  });

  const toursQuery = useQuery({
    queryKey: ['admin', 'tours'],
    queryFn: async () => (await api.listTours()).tours ?? [],
    enabled: Boolean(isAdmin),
  });

  const knowledgeQuery = useQuery({
    queryKey: ['admin', 'knowledge'],
    queryFn: async () => api.listKnowledgeDocs(),
    enabled: Boolean(isAdmin),
  });

  const availableBeds = useMemo(
    () => (bedsQuery.data ?? []).filter((b) => b.status === 'available'),
    [bedsQuery.data]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading admin console...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Card className="p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900">Admin Console</h1>
          <p className="mt-2 text-sm text-slate-600">
            Admin sign-in is required to manage properties, rooms, beds, weekly dining menus,
            tour requests, and RAG knowledge documents.
          </p>
          <Link to="/auth" className="mt-5 inline-block">
            <Button>Sign In as Admin</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const property = propertyQuery.data ?? null;
  const rooms = roomsQuery.data ?? [];
  const beds = bedsQuery.data ?? [];

  const openOnboardModal = (prefill?: OnboardPrefill) => {
    setOnboardPrefill(prefill ?? null);
    setOnboardOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium text-[#0f766e]">
            {property ? `${property.name} · Real-Time Operations` : 'Property Operations & AI Sync'}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">
            Admin &amp; Owner Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
          {[
            { id: 'matrix' as const, label: 'Bed Matrix & Rooms', icon: BedDouble },
            { id: 'property' as const, label: 'Property & Import', icon: Building2 },
            { id: 'operations' as const, label: 'Tour Leads & Tickets', icon: Wrench },
            { id: 'menu' as const, label: 'Weekly Menu', icon: Utensils },
            { id: 'knowledge' as const, label: 'Knowledge Base', icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {globalNotice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          <span>{globalNotice}</span>
          <button
            type="button"
            onClick={() => setGlobalNotice(null)}
            className="ml-4 font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'matrix' && (
        <RoomAndBedMatrixTab
          property={property}
          rooms={rooms}
          beds={beds}
          residents={residentsQuery.data ?? []}
          onOpenOnboard={(prefill) => openOnboardModal(prefill)}
        />
      )}

      {activeTab === 'property' && <PropertyAndImportTab property={property} />}

      {activeTab === 'operations' && (
        <OperationsTab
          tickets={ticketsQuery.data ?? []}
          tours={toursQuery.data ?? []}
          hasAvailableBed={availableBeds.length > 0}
          onConvertTourToResident={(prefill) => openOnboardModal(prefill)}
        />
      )}

      {activeTab === 'menu' && <WeeklyMenuEditorTab property={property} />}

      {activeTab === 'knowledge' && (
        <KnowledgeBaseTab
          property={property}
          documents={knowledgeQuery.data?.documents ?? []}
          totalChunks={knowledgeQuery.data?.totalChunks ?? 0}
        />
      )}

      <OnboardResidentModal
        open={onboardOpen}
        prefill={onboardPrefill}
        availableBeds={availableBeds}
        rooms={rooms}
        onClose={() => setOnboardOpen(false)}
        onSuccessMessage={(msg) => setGlobalNotice(msg)}
      />
    </div>
  );
}
