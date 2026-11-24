export type UserRole = 'guest' | 'resident' | 'admin';
export type SharingType = 'single' | 'double' | 'triple';
export type GenderPreference = 'male' | 'female' | 'any';
export type DietaryType = 'veg' | 'non-veg' | 'jain';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  gender: 'male' | 'female' | 'other';
  occupation?: string | null;
  kycVerified: boolean;
  assignedPropertyId?: {
    _id: string;
    name: string;
    slug: string;
    address: PropertyData['address'];
    contactPhone: string;
    contactEmail: string;
  } | string | null;
  assignedRoomId?: {
    _id: string;
    roomNumber: string;
    floor: number;
    sharingType: SharingType;
    isAC: boolean;
    monthlyRent: number;
    securityDeposit: number;
  } | string | null;
  assignedBedId?: {
    _id: string;
    bedCode: string;
    status: string;
    checkInDate?: string;
    expectedVacateDate?: string;
  } | string | null;
  checkInDate?: string | null;
  noticeEndDate?: string | null;
  mealOptOuts: Array<{ date: string; meals: MealSlot[] }>;
}

export interface MenuItem {
  name: string;
  dietary: DietaryType;
}

export interface DailyMenu {
  day: DayOfWeek;
  breakfast: MenuItem[];
  lunch: MenuItem[];
  dinner: MenuItem[];
}

export interface PropertyData {
  _id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  address: {
    line1: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    landmarks: string[];
  };
  contactPhone: string;
  contactEmail: string;
  genderPolicy: 'co-ed' | 'male-only' | 'female-only';
  amenities: string[];
  houseRulesSummary: {
    curfewTime: string;
    visitorHours: string;
    overnightGuestPolicy: string;
    quietHours: string;
    smokingAlcoholPolicy: string;
    securityDepositRefundDays: number;
    gstRatePercent: number;
  };
  weeklyMenu: DailyMenu[];
  mealTimings?: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  googleMapsUrl?: string;
  electricityRatePerUnit?: number;
  heroImageUrl?: string;
}

export interface RoomData {
  _id: string;
  propertyId: string | PropertyData;
  roomNumber: string;
  floor: number;
  sharingType: SharingType;
  isAC: boolean;
  genderPreference: GenderPreference;
  monthlyRent: number;
  securityDeposit: number;
  lockInMonths: number;
  noticePeriodDays: number;
  electricityRatePerUnit: number;
  estimatedMonthlyElectricity: number;
  amenities: string[];
  totalBeds: number;
  vacantBedsCount: number;
  imageUrl?: string;
  description?: string;
  isActive: boolean;
}

export interface BedMatrixItem {
  _id: string;
  bedCode: string;
  status: 'available' | 'occupied' | 'notice_period' | 'reserved' | 'maintenance';
  roomId: {
    _id: string;
    roomNumber: string;
    floor: number;
    sharingType: SharingType;
    isAC: boolean;
    genderPreference: GenderPreference;
    monthlyRent: number;
  };
  currentTenantId?: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    occupation?: string;
    noticeEndDate?: string;
  } | null;
  checkInDate?: string | null;
  noticeGivenDate?: string | null;
  expectedVacateDate?: string | null;
  notes?: string;
}

export interface InvoiceData {
  _id: string;
  billingMonth: string;
  baseRent: number;
  securityDepositCharge?: number;
  electricityUnits: number;
  electricityCharge: number;
  mealDeduction: number;
  gstAmount: number;
  totalAmount: number;
  paymentStatus: 'unpaid' | 'paid' | 'overdue' | 'waived';
  paymentGateway?: string;
  transactionId?: string;
  paidAt?: string;
  receiptNumber?: string;
  hraEligible: boolean;
  notes?: string;
  userId?: { _id: string; name: string; email: string; phone: string } | string;
  propertyId?: { name: string; address: PropertyData['address'] };
  roomId?: { roomNumber: string; sharingType: SharingType; isAC: boolean };
  bedId?: { bedCode: string };
}

export interface TicketData {
  _id: string;
  category: 'Wi-Fi' | 'Plumbing' | 'Housekeeping' | 'AC' | 'Electrical' | 'Other';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'Open' | 'In Progress' | 'Resolved';
  assignedStaff?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  residentId?: { _id: string; name: string; email: string };
  roomId?: { roomNumber: string; floor: number };
}

export interface TourBookingData {
  _id: string;
  tourMode: 'physical' | 'virtual';
  tourSlotDate: string;
  tourSlotTime: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  sharingPreference?: SharingType;
  moveInTimeline?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'converted_to_resident' | 'cancelled' | string;
  roomId?: { _id?: string; roomNumber: string; sharingType: SharingType; isAC: boolean } | null;
  createdAt: string;
}

export interface KnowledgeDocSummary {
  propertyId: string;
  sourceType:
    | 'house_rules'
    | 'policy'
    | 'neighborhood_guide'
    | 'room_inventory'
    | 'weekly_menu'
    | 'faq'
    | 'uploaded_doc';
  sourceSection: string;
  title: string;
  category?: string;
  chunkCount: number;
  updatedAt: string;
  preview: string;
  hasEmbeddings: boolean;
}

export interface KnowledgeDocContent {
  title: string;
  sourceType: KnowledgeDocSummary['sourceType'];
  sourceSection: string;
  category?: string;
  content: string;
  chunkCount: number;
}
