import type {
  BedMatrixItem,
  DailyMenu,
  InvoiceData,
  KnowledgeDocContent,
  KnowledgeDocSummary,
  MealSlot,
  PropertyData,
  RoomData,
  TicketData,
  TourBookingData,
  UserProfile,
} from '../types/pg.ts';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  let parseFailed = false;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    parseFailed = true;
    data = { error: 'Unexpected non-JSON response from server' };
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed with status ${res.status}`;
    throw new ApiError(errMsg, res.status);
  }

  if (parseFailed || data === null) {
    throw new ApiError('Unexpected non-JSON response from API endpoint.', res.status);
  }

  return data as T;
}

export const api = {
  health: () =>
    apiFetch<{ status: string; database: string; geminiConfigured: boolean }>('/api/health'),

  // Auth
  setupStatus: () => apiFetch<{ hasAdmin: boolean }>('/api/auth/setup-status'),
  bootstrapAdmin: (payload: {
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }) =>
    apiFetch<{ message: string; user: UserProfile }>('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => apiFetch<{ user: UserProfile }>('/api/auth/me'),
  login: (payload: { email: string; password: string }) =>
    apiFetch<{ user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    gender: 'male' | 'female' | 'other';
    occupation?: string;
  }) =>
    apiFetch<{ user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () =>
    apiFetch<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    }),

  // Property & Menu
  getPrimaryProperty: () =>
    apiFetch<{ property: PropertyData | null }>('/api/properties/primary'),
  createProperty: (payload: {
    name: string;
    tagline?: string;
    description: string;
    address: PropertyData['address'];
    googleMapsUrl?: string;
    contactPhone: string;
    contactEmail: string;
    genderPolicy: PropertyData['genderPolicy'];
    electricityRatePerUnit: number;
    amenities: string[];
    houseRulesSummary?: Partial<PropertyData['houseRulesSummary']>;
    mealTimings?: PropertyData['mealTimings'];
    heroImageUrl?: string;
  }) =>
    apiFetch<{ message: string; property: PropertyData }>('/api/properties', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProperty: (
    propertyId: string,
    payload: Partial<{
      name: string;
      tagline: string;
      description: string;
      address: PropertyData['address'];
      googleMapsUrl: string;
      contactPhone: string;
      contactEmail: string;
      genderPolicy: PropertyData['genderPolicy'];
      electricityRatePerUnit: number;
      amenities: string[];
      houseRulesSummary: Partial<PropertyData['houseRulesSummary']>;
      mealTimings: PropertyData['mealTimings'];
      heroImageUrl: string;
    }>
  ) =>
    apiFetch<{ message: string; property: PropertyData }>(`/api/properties/${propertyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateWeeklyMenu: (
    propertyId: string,
    weeklyMenu: DailyMenu[],
    mealTimings?: PropertyData['mealTimings']
  ) =>
    apiFetch<{ message: string; property: PropertyData }>(
      `/api/properties/${propertyId}/menu`,
      {
        method: 'PUT',
        body: JSON.stringify({ weeklyMenu, ...(mealTimings ? { mealTimings } : {}) }),
      }
    ),

  // Rooms & Beds
  listRooms: (params?: {
    sharingType?: string;
    isAC?: string;
    genderPreference?: string;
    onlyAvailable?: boolean;
  }) => {
    const search = new URLSearchParams();
    if (params?.sharingType && params.sharingType !== 'all') {
      search.set('sharingType', params.sharingType);
    }
    if (params?.isAC && params.isAC !== 'all') {
      search.set('isAC', params.isAC);
    }
    if (params?.genderPreference && params.genderPreference !== 'all') {
      search.set('genderPreference', params.genderPreference);
    }
    if (params?.onlyAvailable) {
      search.set('onlyAvailable', 'true');
    }
    const qs = search.toString();
    return apiFetch<{ rooms: RoomData[] }>(`/api/rooms${qs ? `?${qs}` : ''}`);
  },
  createRoom: (payload: {
    propertyId: string;
    roomNumber: string;
    floor: number;
    sharingType: RoomData['sharingType'];
    isAC: boolean;
    genderPreference: RoomData['genderPreference'];
    monthlyRent: number;
    securityDeposit: number;
    lockInMonths: number;
    noticePeriodDays: number;
    electricityRatePerUnit: number;
    estimatedMonthlyElectricity: number;
    amenities: string[];
    description?: string;
    imageUrl?: string;
  }) =>
    apiFetch<{ message: string; room: RoomData }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoom: (
    roomId: string,
    payload: Partial<{
      roomNumber: string;
      floor: number;
      sharingType: RoomData['sharingType'];
      isAC: boolean;
      genderPreference: RoomData['genderPreference'];
      monthlyRent: number;
      securityDeposit: number;
      lockInMonths: number;
      noticePeriodDays: number;
      electricityRatePerUnit: number;
      estimatedMonthlyElectricity: number;
      amenities: string[];
      description: string;
      imageUrl: string;
      isActive: boolean;
    }>
  ) =>
    apiFetch<{ message: string; room: RoomData }>(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteRoom: (roomId: string) =>
    apiFetch<{ message: string }>(`/api/rooms/${roomId}`, {
      method: 'DELETE',
    }),
  getBedMatrix: () =>
    apiFetch<{ beds: BedMatrixItem[] }>('/api/rooms/beds/matrix'),
  allocateBed: (
    bedId: string,
    payload: {
      status: BedMatrixItem['status'];
      tenantId?: string | null;
      checkInDate?: string | null;
      noticeGivenDate?: string | null;
      expectedVacateDate?: string | null;
      notes?: string;
    }
  ) =>
    apiFetch<{ message: string; bed: BedMatrixItem }>(
      `/api/rooms/beds/${bedId}/allocate`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),

  // Bookings & Invoices
  scheduleTour: (payload: {
    propertyId?: string;
    roomId?: string;
    tourMode: 'physical' | 'virtual';
    tourSlotDate: string;
    tourSlotTime: string;
    leadName: string;
    leadEmail: string;
    leadPhone: string;
    sharingPreference?: 'single' | 'double' | 'triple';
    moveInTimeline?: string;
    notes?: string;
  }) =>
    apiFetch<{ message: string; booking: TourBookingData }>('/api/bookings/tours', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listTours: () => apiFetch<{ tours: TourBookingData[] }>('/api/bookings/tours'),
  updateTourStatus: (
    tourId: string,
    payload: {
      status: 'pending' | 'confirmed' | 'completed' | 'converted_to_resident' | 'cancelled';
      notes?: string;
    }
  ) =>
    apiFetch<{ message: string; booking: TourBookingData }>(`/api/bookings/tours/${tourId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  reserveBed: (payload: { roomId: string; moveInDate: string; notes?: string }) =>
    apiFetch<{ message: string }>('/api/bookings/reserve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listInvoices: () => apiFetch<{ invoices: InvoiceData[] }>('/api/bookings/invoices'),
  payInvoice: (
    invoiceId: string,
    paymentGateway: 'razorpay_mock' | 'stripe_mock' | 'upi'
  ) =>
    apiFetch<{ message: string; invoice: InvoiceData }>(
      `/api/bookings/invoices/${invoiceId}/pay`,
      {
        method: 'POST',
        body: JSON.stringify({ paymentGateway }),
      }
    ),

  // Tickets
  listTickets: () => apiFetch<{ tickets: TicketData[] }>('/api/tickets'),
  createTicket: (payload: {
    category: TicketData['category'];
    title: string;
    description: string;
    priority: TicketData['priority'];
  }) =>
    apiFetch<{ message: string; ticket: TicketData }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTicket: (
    ticketId: string,
    payload: {
      status?: TicketData['status'];
      assignedStaff?: string;
      resolutionNotes?: string;
    }
  ) =>
    apiFetch<{ message: string; ticket: TicketData }>(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Residents
  listResidents: () => apiFetch<{ residents: UserProfile[] }>('/api/residents'),
  onboardResident: (payload: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    gender: 'male' | 'female' | 'other';
    occupation?: string;
    bedId: string;
    checkInDate?: string;
    billingMonth?: string;
    electricityUnits?: number;
    includeDeposit?: boolean;
    tourBookingId?: string;
  }) =>
    apiFetch<{ message: string; invoice: InvoiceData }>('/api/residents/onboard', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  toggleMealOptOut: (payload: { date: string; meals: MealSlot[] }) =>
    apiFetch<{ message: string; mealOptOuts: Array<{ date: string; meals: MealSlot[] }> }>(
      '/api/residents/me/meal-opt-outs',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  // Knowledge Base Manager (Admin)
  listKnowledgeDocs: () =>
    apiFetch<{ documents: KnowledgeDocSummary[]; totalChunks: number }>(
      '/api/ai/knowledge'
    ),
  getKnowledgeContent: (params: {
    propertyId?: string;
    sourceType: KnowledgeDocSummary['sourceType'];
    sourceSection: string;
  }) => {
    const search = new URLSearchParams({
      sourceType: params.sourceType,
      sourceSection: params.sourceSection,
    });
    if (params.propertyId) search.set('propertyId', params.propertyId);
    return apiFetch<{ document: KnowledgeDocContent }>(
      `/api/ai/knowledge/content?${search.toString()}`
    );
  },
  ingestTextKnowledge: (payload: {
    propertyId?: string;
    sourceType: KnowledgeDocSummary['sourceType'];
    sourceSection: string;
    title: string;
    category?: string;
    content: string;
  }) =>
    apiFetch<{ message: string }>('/api/ai/knowledge/text', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  uploadKnowledgeFile: (formData: FormData) =>
    apiFetch<{ message: string }>('/api/ai/knowledge/upload', {
      method: 'POST',
      body: formData,
    }),
  reindexKnowledge: () =>
    apiFetch<{ message: string; summary: { roomsSynced: number; chunksReembedded: number } }>(
      '/api/ai/knowledge/reindex',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    ),
  deleteKnowledgeDoc: (payload: {
    propertyId: string;
    sourceType: KnowledgeDocSummary['sourceType'];
    sourceSection: string;
  }) =>
    apiFetch<{ message: string }>('/api/ai/knowledge', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    }),

  // Admin Real PG Import & Sample Reset
  resetSampleData: () =>
    apiFetch<{ message: string }>('/api/admin/sample-data', {
      method: 'DELETE',
    }),
  importRealPgData: (payload: {
    data: unknown;
    markdownRules?: string;
    markdownTitle?: string;
    replaceExisting?: boolean;
  }) =>
    apiFetch<{
      message: string;
      summary: {
        propertyName: string;
        roomsCreated: number;
        bedsCreated: number;
        knowledgeChunksCreated: number;
      };
    }>('/api/admin/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface StreamCitation {
  title: string;
  sourceSection: string;
  sourceType: string;
  score: number;
}

export interface StreamChatCallbacks {
  onSources?: (payload: { searchMode: string; citations: StreamCitation[] }) => void;
  onToolCall?: (payload: { name: string; args: Record<string, unknown> }) => void;
  onUiAction?: (payload: { type: string; payload: Record<string, unknown> }) => void;
  onDelta?: (text: string) => void;
  onDone?: (payload: { fullText: string; citations: StreamCitation[] }) => void;
  onError?: (error: string) => void;
}

export async function streamConciergeChat(
  params: {
    message: string;
    history: Array<{ role: 'user' | 'model'; text: string }>;
    filter?: { sourceType?: string; propertyId?: string };
  },
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok || !res.body) {
    let errMsg = `AI Concierge request failed (${res.status})`;
    try {
      const json = await res.json();
      if (typeof json?.error === 'string') errMsg = json.error;
    } catch {
      // ignore parse failure
    }
    callbacks.onError?.(errMsg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      if (!frame.trim()) continue;
      let eventName = 'message';
      let dataLine = '';

      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLine += line.slice(5).trim();
        }
      }

      if (!dataLine) continue;
      try {
        const parsed = JSON.parse(dataLine);
        if (eventName === 'sources') callbacks.onSources?.(parsed);
        else if (eventName === 'tool_call') callbacks.onToolCall?.(parsed);
        else if (eventName === 'ui_action') callbacks.onUiAction?.(parsed);
        else if (eventName === 'delta') callbacks.onDelta?.(parsed.text ?? '');
        else if (eventName === 'done') callbacks.onDone?.(parsed);
        else if (eventName === 'error') callbacks.onError?.(parsed.error ?? 'Stream error');
      } catch {
        // Skip malformed partial frame
      }
    }
  }
}
