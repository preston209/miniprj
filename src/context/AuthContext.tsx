import React, { createContext, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import type { SharingType, UserProfile } from '../types/pg.ts';

export interface TourModalPrefill {
  roomId?: string;
  roomNumber?: string;
  sharingPreference?: SharingType;
  tourMode?: 'physical' | 'virtual';
  notes?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  refetchUser: () => Promise<void>;
  logout: () => Promise<void>;
  tourModalOpen: boolean;
  tourPrefill: TourModalPrefill;
  openTourModal: (prefill?: TourModalPrefill) => void;
  closeTourModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [tourPrefill, setTourPrefill] = useState<TourModalPrefill>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await api.me();
        return res.user ?? null;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const refetchUser = async () => {
    await refetch();
  };

  const logout = async () => {
    await api.logout();
    queryClient.setQueryData(['auth', 'me'], null);
    await queryClient.invalidateQueries();
  };

  const openTourModal = (prefill: TourModalPrefill = {}) => {
    setTourPrefill(prefill);
    setTourModalOpen(true);
  };

  const closeTourModal = () => {
    setTourModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        isLoading,
        refetchUser,
        logout,
        tourModalOpen,
        tourPrefill,
        openTourModal,
        closeTourModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
