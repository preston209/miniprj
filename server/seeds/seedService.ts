import crypto from 'crypto';
import { Bed } from '../models/Bed.ts';
import { Booking } from '../models/Booking.ts';
import {
  KnowledgeChunk,
  type KnowledgeSourceType,
} from '../models/KnowledgeChunk.ts';
import { Property, type IDailyMenu } from '../models/Property.ts';
import { Room } from '../models/Room.ts';
import { Ticket } from '../models/Ticket.ts';
import { User } from '../models/User.ts';
import { generateEmbedding, isGeminiConfigured } from '../utils/geminiClient.ts';

interface SeedKnowledgeDoc {
  sourceType: KnowledgeSourceType;
  sourceSection: string;
  title: string;
  category: string;
  content: string;
}

export const WEEKLY_MENU: IDailyMenu[] = [
  {
    day: 'Monday',
    breakfast: [
      { name: 'Masala Dosa with Coconut Chutney & Sambar', dietary: 'veg' },
      { name: 'Poha with Roasted Peanuts (No Onion/Garlic)', dietary: 'jain' },
      { name: 'Boiled Eggs & Brown Bread Toast', dietary: 'non-veg' },
    ],
    lunch: [
      { name: 'Phulka, Jeera Rice, Dal Tadka & Aloo Gobi', dietary: 'veg' },
      { name: 'Jain Moong Dal, Jeera Rice & Bhindi Fry', dietary: 'jain' },
      { name: 'Curd & Pickle', dietary: 'veg' },
    ],
    dinner: [
      { name: 'Chapati, Paneer Butter Masala & Steamed Rice', dietary: 'veg' },
      { name: 'Homestyle Chicken Curry & Steamed Rice', dietary: 'non-veg' },
      { name: 'Jain Paneer Tikka Masala & Chapati', dietary: 'jain' },
    ],
  },
  {
    day: 'Tuesday',
    breakfast: [
      { name: 'Aloo Paratha with Curd & Mint Chutney', dietary: 'veg' },
      { name: 'Idli Sambar (No Onion/Garlic)', dietary: 'jain' },
      { name: 'Masala Omelette & Toast', dietary: 'non-veg' },
    ],
    lunch: [
      { name: 'Rajma Chawal, Mix Veg & Boondi Raita', dietary: 'veg' },
      { name: 'Jain Toor Dal, Steamed Rice & Lauki Sabzi', dietary: 'jain' },
    ],
    dinner: [
      { name: 'Roti, Palak Paneer & Dal Fry', dietary: 'veg' },
      { name: 'Egg Bhurji & Tawa Roti', dietary: 'non-veg' },
      { name: 'Jain Palak Tofu & Roti', dietary: 'jain' },
    ],
  },
  {
    day: 'Wednesday',
    breakfast: [
      { name: 'Rava Upma, Medu Vada & Filter Coffee', dietary: 'veg' },
      { name: 'Sabudana Khichdi', dietary: 'jain' },
      { name: 'Scrambled Eggs & Multigrain Toast', dietary: 'non-veg' },
    ],
    lunch: [
      { name: 'Chapati, Chole Masala, Pulao & Salad', dietary: 'veg' },
      { name: 'Jain Chana Dal, Rice & Jeera Paneer', dietary: 'jain' },
    ],
    dinner: [
      { name: 'Butter Naan, Kadai Veg & Dal Makhani', dietary: 'veg' },
      { name: 'Hyderabadi Chicken Dum Biryani with Mirchi Ka Salan', dietary: 'non-veg' },
      { name: 'Jain Veg Pulao & Dal Makhani', dietary: 'jain' },
    ],
  },
  {
    day: 'Thursday',
    breakfast: [
      { name: 'Steamed Idli, Vada & Tomato Chutney', dietary: 'veg' },
      { name: 'Moong Dal Chilla with Green Chutney', dietary: 'jain' },
      { name: 'Poached Eggs & Hash Browns', dietary: 'non-veg' },
    ],
    lunch: [
      { name: 'Kadhi Pakora, Steamed Rice, Roti & Bhindi Masala', dietary: 'veg' },
      { name: 'Jain Kadhi, Rice & Ridge Gourd Curry', dietary: 'jain' },
    ],
    dinner: [
      { name: 'Chapati, Malai Kofta & Masoor Dal', dietary: 'veg' },
      { name: 'Pepper Chicken Roast & Malabar Parotta', dietary: 'non-veg' },
      { name: 'Jain Dry Fruit Kofta & Chapati', dietary: 'jain' },
    ],
  },
  {
    day: 'Friday',
    breakfast: [
      { name: 'Puri Bhaji & Semiya Kesari', dietary: 'veg' },
      { name: 'Vegetable Daliya (No Root Veggies)', dietary: 'jain' },
      { name: 'Chicken Sausage & Toast', dietary: 'non-veg' },
    ],
    lunch: [
      { name: 'Sambar Rice, Curd Rice, Appalam & Beans Poriyal', dietary: 'veg' },
      { name: 'Jain Dal Khichdi & Kadhi', dietary: 'jain' },
    ],
    dinner: [
      { name: 'Tandoori Roti, Matar Paneer & Jeera Rice', dietary: 'veg' },
      { name: 'Butter Chicken & Garlic Naan', dietary: 'non-veg' },
      { name: 'Jain Matar Paneer & Tawa Roti', dietary: 'jain' },
    ],
  },
  {
    day: 'Saturday',
    breakfast: [
      { name: 'Chole Bhature & Sweet Lassi', dietary: 'veg' },
      { name: 'Khaman Dhokla & Mint Chutney', dietary: 'jain' },
      { name: 'Cheese Omelette & Cornflakes', dietary: 'non-veg' },
    ],
    lunch: [
      { name: 'Veg Fried Rice, Gobi Manchurian & Hot Sour Soup', dietary: 'veg' },
      { name: 'Jain Veg Hakka Noodles (No Onion/Garlic)', dietary: 'jain' },
    ],
    dinner: [
      { name: 'Phulka, Bhindi Do Pyaza, Dal Tadka & Gulab Jamun', dietary: 'veg' },
      { name: 'Grilled Fish Curry & Steamed Rice', dietary: 'non-veg' },
      { name: 'Jain Shahi Paneer & Phulka', dietary: 'jain' },
    ],
  },
  {
    day: 'Sunday',
    breakfast: [
      { name: 'Ghee Pongal, Medu Vada & Filter Coffee', dietary: 'veg' },
      { name: 'Paneer Paratha with Curd', dietary: 'jain' },
      { name: 'Sunny Side Up Eggs & Baked Beans', dietary: 'non-veg' },
    ],
    lunch: [
      { name: 'Sunday Special Veg Biryani, Paneer 65 & Raita', dietary: 'veg' },
      { name: 'Sunday Special Chicken Biryani & Raita', dietary: 'non-veg' },
      { name: 'Jain Kaju Pulao & Boondi Raita', dietary: 'jain' },
    ],
    dinner: [
      { name: 'Light Khichdi, Tomato Soup, Salad & Fruit Custard', dietary: 'veg' },
      { name: 'Jain Moong Khichdi & Fruit Custard', dietary: 'jain' },
    ],
  },
];

export const PG_KNOWLEDGE_DOCUMENTS: SeedKnowledgeDoc[] = [
  {
    sourceType: 'house_rules',
    sourceSection: 'Section 1: Biometric Entry & Curfew Policy',
    title: 'House Rules & Curfew Timings',
    category: 'rules',
    content:
      'HavenStay Koramangala Executive PG operates with 24/7 biometric access and CCTV security across all entry gates and corridors. Standard quiet curfew starts at 11:30 PM. Residents returning after 11:30 PM due to late office shifts, flights, or emergencies can request an instant digital late-entry pass via the Resident Portal or notify the night warden at the front desk. Quiet hours are strictly observed from 11:00 PM to 6:30 AM inside all residential floors.',
  },
  {
    sourceType: 'house_rules',
    sourceSection: 'Section 2: Smoking, Alcohol & Common Area Conduct',
    title: 'Smoking, Alcohol & Conduct Rules',
    category: 'rules',
    content:
      'HavenStay Koramangala is a strictly smoke-free and alcohol-free property. Possession or consumption of cigarettes, vapes, alcohol, or banned substances inside rooms, balconies, corridors, or the rooftop lounge incurs an immediate ₹2,500 penalty on the first offense and immediate termination of residency without deposit refund on repeat offenses. Electric induction stoves, high-wattage heaters, and personal refrigerators are not permitted inside bedrooms for fire safety.',
  },
  {
    sourceType: 'policy',
    sourceSection: 'Section 3: Security Deposit, Lock-In & Refund Policy',
    title: 'Security Deposit & Notice Period Refund Policy',
    category: 'billing',
    content:
      'A refundable security deposit (typically equal to 1 to 1.5 months rent depending on room category) is collected prior to check-in. All rooms carry a standard 2-month lock-in period (1 month for Single Executive Studios) and require a 30-day prior written notice submitted through the Resident Portal before vacating. Upon checkout inspection, 100% of the refundable security deposit—after deducting pending electricity sub-meter dues or documented room damages—is refunded directly to the resident bank account within 7 working days. Early exit during the lock-in period forfeits 50% of the security deposit.',
  },
  {
    sourceType: 'policy',
    sourceSection: 'Section 4: Visitor & Overnight Guest Policy',
    title: 'Visitor & Overnight Guest Guidelines',
    category: 'visitors',
    content:
      'Day visitors (friends and family) are welcome between 9:00 AM and 8:00 PM exclusively in the ground-floor co-working lounge and dining hall after logging government photo ID at the security desk. Visitors are not permitted inside residential room floors to preserve resident privacy. Overnight guests are generally not permitted inside shared rooms; however, single-occupancy room residents may request prior written admin approval 48 hours in advance for visiting parents or siblings at a nominal ₹600/night guest fee (maximum 3 nights per month).',
  },
  {
    sourceType: 'policy',
    sourceSection: 'Section 5: Rent, GST/HRA Receipts & Electricity Sub-Meter Policy',
    title: 'Monthly Rent & Sub-Meter Electricity Billing',
    category: 'billing',
    content:
      'Monthly rent is generated on the 1st of every month and is due by the 5th via UPI, Razorpay, or Stripe in the Resident Portal. Late payments after the 7th incur ₹150/day late fee. All long-term residential PG stays (over 90 days) qualify for 0% GST under residential hostel exemption and receive downloadable HRA-compliant rent receipts with landlord PAN and property address. Every room has a dedicated digital electricity sub-meter billed at ₹9 per unit (divided equally among occupied beds in shared rooms). Average monthly electricity per bed ranges from ₹600 (Non-AC) to ₹1,300 (AC).',
  },
  {
    sourceType: 'house_rules',
    sourceSection: 'Section 6: Dining Timings, Meal Opt-Out & Housekeeping',
    title: 'Dining Schedule, Meal Opt-Out & Housekeeping',
    category: 'amenities',
    content:
      'Fresh homestyle meals are served daily in the dining hall: Breakfast 7:30 AM – 9:45 AM, Lunch 12:30 PM – 2:30 PM (tiffin packing available before 9:30 AM), and Dinner 7:45 PM – 10:00 PM. Residents can toggle meal opt-outs in the Resident Portal at least 4 hours prior to a meal slot to prevent food waste; opting out of 15 or more meals in a billing cycle earns a ₹45/meal sustainability credit on the next invoice. Room cleaning and bathroom sanitization occur 3 times a week (Mon/Wed/Fri or Tue/Thu/Sat), and bed linen is laundered every Sunday. High-speed 300 Mbps dual-band Wi-Fi and washing machines on every floor are included in rent.',
  },
  {
    sourceType: 'neighborhood_guide',
    sourceSection: 'Section 7: Koramangala 4th Block Commute & Local Guide',
    title: 'Neighborhood, Tech Parks & Transit Connectivity',
    category: 'location',
    content:
      'HavenStay Koramangala Executive PG is located on 80 Feet Road, Koramangala 4th Block, Bengaluru 560034, just 250 meters from Sony World Signal and 600 meters from Forum Nexus Mall. Commute times: Indiranagar 100ft Road is 15 mins (4.2 km), EGL Embassy Golf Links Business Park is 12 mins (3.5 km), HSR Layout Sector 1 is 12 mins (3.8 km), Bellandur / Ecospace Outer Ring Road is 22 mins (7.5 km), and Trinity Metro Station (Purple Line) is 18 mins via BMTC AC bus or metro feeder. Nearby essentials within 5 minutes walk include Cult.fit Koramangala, Manipal Hospital Clinic, Third Wave Coffee, and 24/7 Apollo Pharmacy.',
  },
];

function computeHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export interface SeedSummary {
  skipped?: boolean;
  reason?: string;
  propertyId: string;
  roomsCount: number;
  bedsCount: number;
  usersCreated: number;
  chunksCreated: number;
  embeddedWithGemini: boolean;
}

let inFlightSeed: Promise<SeedSummary> | null = null;

export async function seedDatabase(options?: {
  clearExisting?: boolean;
  forceSample?: boolean;
  adminEmail?: string;
  adminName?: string;
  userPassword?: string;
}): Promise<SeedSummary> {
  if (!options && inFlightSeed) {
    return inFlightSeed;
  }
  if (inFlightSeed) {
    await inFlightSeed.catch(() => {});
  }

  const run = runSeedDatabase(options);
  inFlightSeed = run;
  try {
    return await run;
  } finally {
    if (inFlightSeed === run) {
      inFlightSeed = null;
    }
  }
}

async function runSeedDatabase(options?: {
  clearExisting?: boolean;
  forceSample?: boolean;
  adminEmail?: string;
  adminName?: string;
  userPassword?: string;
}): Promise<SeedSummary> {
  const sampleFlagEnabled = process.env.SEED_SAMPLE_DATA === 'true';
  if (!options?.forceSample && !sampleFlagEnabled) {
    return {
      skipped: true,
      reason: 'SEED_SAMPLE_DATA is not set to "true". Skipping sample data seeding.',
      propertyId: '',
      roomsCount: 0,
      bedsCount: 0,
      usersCreated: 0,
      chunksCreated: 0,
      embeddedWithGemini: isGeminiConfigured(),
    };
  }

  if (!options?.clearExisting) {
    const existingPropCount = await Property.countDocuments({});
    if (existingPropCount > 0 && !options?.userPassword) {
      return {
        skipped: true,
        reason: 'Database already contains a PG property. Skipping sample data seeding.',
        propertyId: '',
        roomsCount: 0,
        bedsCount: 0,
        usersCreated: 0,
        chunksCreated: 0,
        embeddedWithGemini: isGeminiConfigured(),
      };
    }
  }

  const prevSkip = process.env.SKIP_VECTOR_HOOKS;
  process.env.SKIP_VECTOR_HOOKS = 'true';

  try {
    if (options?.clearExisting) {
      await Promise.all([
        KnowledgeChunk.deleteMany({}),
        Ticket.deleteMany({}),
        Booking.deleteMany({}),
        Bed.deleteMany({}),
        Room.deleteMany({}),
        User.deleteMany({}),
        Property.deleteMany({}),
      ]);
    }

    let property = await Property.findOne({ slug: 'havenstay-koramangala' });
    if (!property) {
      property = await Property.create({
        name: 'HavenStay Koramangala Executive PG',
        slug: 'havenstay-koramangala',
        tagline: 'Thoughtfully designed co-living with homestyle dining & 300 Mbps Wi-Fi',
        description:
          'Premium managed PG accommodation in the heart of Koramangala 4th Block, Bengaluru. Features biometric security, ergonomic WFH desks, freshly cooked Veg/Non-Veg/Jain meals, and transparent sub-meter billing.',
        address: {
          line1: 'No. 42, 80 Feet Road, Near Sony World Signal',
          area: 'Koramangala 4th Block',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560034',
          landmarks: [
            'Sony World Signal (250m)',
            'Nexus Koramangala Mall (600m)',
            'Embassy Golf Links (3.5 km)',
          ],
        },
        contactPhone: '+91 80 4123 7890',
        contactEmail: 'concierge@havenstay.in',
        genderPolicy: 'co-ed',
        amenities: [
          '300 Mbps Dual-Band Wi-Fi',
          '24/7 Biometric Security & CCTV',
          '3-Time Homestyle Meals (Veg / Non-Veg / Jain)',
          'Power Backup (DG + Inverter)',
          'Co-Working & Study Lounge',
          'Washing Machines & Steam Ironing',
          'Housekeeping 3x Weekly',
          'Covered Two-Wheeler Parking',
        ],
        houseRulesSummary: {
          curfewTime: '11:30 PM (Digital late-entry pass available)',
          visitorHours: '9:00 AM – 8:00 PM in Ground Floor Lounge',
          overnightGuestPolicy:
            'Not permitted in shared rooms; Single room residents require 48h prior admin approval',
          quietHours: '11:00 PM – 6:30 AM',
          smokingAlcoholPolicy: 'Strictly smoke-free and alcohol-free premises',
          securityDepositRefundDays: 7,
          gstRatePercent: 0,
        },
        weeklyMenu: WEEKLY_MENU,
        heroImageUrl: '/src/assets/images/havenstay_hero_lounge_1795435461346.jpg',
        isActive: true,
      });
    }

    let createdRooms = await Room.find({ propertyId: property._id });
    const createdBedsByCode = new Map<string, InstanceType<typeof Bed>>();

    if (createdRooms.length === 0) {
      const roomConfigs = [
        {
          roomNumber: '101',
          floor: 1,
          sharingType: 'single' as const,
          isAC: true,
          genderPreference: 'any' as const,
          monthlyRent: 22000,
          securityDeposit: 30000,
          lockInMonths: 1,
          noticePeriodDays: 30,
          electricityRatePerUnit: 9,
          estimatedMonthlyElectricity: 1400,
          amenities: ['Attached Balcony', 'Split AC', 'Work Desk', 'Mini Fridge', 'Smart TV'],
          totalBeds: 1,
          bedStatuses: ['available'] as const,
          description: 'Private executive studio with dedicated WFH workstation and balcony.',
          imageUrl: '/src/assets/images/room_single_studio_1795435463380.jpg',
        },
        {
          roomNumber: '102',
          floor: 1,
          sharingType: 'double' as const,
          isAC: true,
          genderPreference: 'female' as const,
          monthlyRent: 14500,
          securityDeposit: 20000,
          lockInMonths: 2,
          noticePeriodDays: 30,
          electricityRatePerUnit: 9,
          estimatedMonthlyElectricity: 950,
          amenities: ['Split AC', 'En-suite Washroom', '2 Wardrobes', 'Study Lamps'],
          totalBeds: 2,
          bedStatuses: ['occupied', 'available'] as const,
          description:
            'Bright twin-sharing AC suite on the female wing with private wardrobe locks.',
          imageUrl: '/src/assets/images/room_double_suite_1795435461509.jpg',
        },
        {
          roomNumber: '201',
          floor: 2,
          sharingType: 'double' as const,
          isAC: true,
          genderPreference: 'male' as const,
          monthlyRent: 14000,
          securityDeposit: 20000,
          lockInMonths: 2,
          noticePeriodDays: 30,
          electricityRatePerUnit: 9,
          estimatedMonthlyElectricity: 950,
          amenities: ['Split AC', 'En-suite Washroom', 'Ergonomic Chairs', 'Geyser'],
          totalBeds: 2,
          bedStatuses: ['occupied', 'reserved'] as const,
          description: 'Spacious twin-sharing AC room overlooking 80 Feet Road greenery.',
          imageUrl: '/src/assets/images/room_double_suite_1795435461509.jpg',
        },
        {
          roomNumber: '202',
          floor: 2,
          sharingType: 'double' as const,
          isAC: false,
          genderPreference: 'male' as const,
          monthlyRent: 11500,
          securityDeposit: 15000,
          lockInMonths: 2,
          noticePeriodDays: 30,
          electricityRatePerUnit: 9,
          estimatedMonthlyElectricity: 550,
          amenities: ['Cross-Ventilated Windows', 'Ceiling Fans', 'Attached Bathroom', '2 Desks'],
          totalBeds: 2,
          bedStatuses: ['available', 'available'] as const,
          description:
            'Well-ventilated twin-sharing non-AC room ideal for budget-conscious professionals.',
          imageUrl: '/src/assets/images/room_double_suite_1795435461509.jpg',
        },
        {
          roomNumber: '301',
          floor: 3,
          sharingType: 'triple' as const,
          isAC: true,
          genderPreference: 'female' as const,
          monthlyRent: 11000,
          securityDeposit: 15000,
          lockInMonths: 2,
          noticePeriodDays: 30,
          electricityRatePerUnit: 9,
          estimatedMonthlyElectricity: 750,
          amenities: ['Split AC', 'Individual Lockers', 'En-suite Bath', 'Shoe Rack'],
          totalBeds: 3,
          bedStatuses: ['occupied', 'available', 'available'] as const,
          description: 'Community-friendly 3-sharing AC room with generous personal storage.',
          imageUrl: '/src/assets/images/room_triple_loft_1795435461316.jpg',
        },
        {
          roomNumber: '302',
          floor: 3,
          sharingType: 'triple' as const,
          isAC: false,
          genderPreference: 'male' as const,
          monthlyRent: 9500,
          securityDeposit: 12000,
          lockInMonths: 2,
          noticePeriodDays: 30,
          electricityRatePerUnit: 9,
          estimatedMonthlyElectricity: 450,
          amenities: ['Large Windows', '3 Study Tables', 'Attached Bathroom', 'Wi-Fi Mesh Node'],
          totalBeds: 3,
          bedStatuses: ['available', 'available', 'maintenance'] as const,
          description: 'Value 3-sharing non-AC room with dedicated study corners and fast Wi-Fi.',
          imageUrl: '/src/assets/images/room_triple_loft_1795435461316.jpg',
        },
      ];

      createdRooms = [];
      for (const cfg of roomConfigs) {
        const vacantCount = cfg.bedStatuses.filter((s) => s === 'available').length;
        const room = await Room.create({
          propertyId: property._id,
          roomNumber: cfg.roomNumber,
          floor: cfg.floor,
          sharingType: cfg.sharingType,
          isAC: cfg.isAC,
          genderPreference: cfg.genderPreference,
          monthlyRent: cfg.monthlyRent,
          securityDeposit: cfg.securityDeposit,
          lockInMonths: cfg.lockInMonths,
          noticePeriodDays: cfg.noticePeriodDays,
          electricityRatePerUnit: cfg.electricityRatePerUnit,
          estimatedMonthlyElectricity: cfg.estimatedMonthlyElectricity,
          amenities: cfg.amenities,
          totalBeds: cfg.totalBeds,
          vacantBedsCount: vacantCount,
          imageUrl: cfg.imageUrl,
          description: cfg.description,
          isActive: true,
        });
        createdRooms.push(room);

        const suffixes = ['A', 'B', 'C'];
        for (let i = 0; i < cfg.bedStatuses.length; i++) {
          const bedCode = `${cfg.roomNumber}-${suffixes[i]}`;
          const bed = await Bed.create({
            propertyId: property._id,
            roomId: room._id,
            bedCode,
            status: cfg.bedStatuses[i],
          });
          createdBedsByCode.set(bedCode, bed);
        }
      }
    } else {
      const existingBeds = await Bed.find({ propertyId: property._id });
      for (const b of existingBeds) {
        createdBedsByCode.set(b.bedCode, b);
      }
    }

    // Seed sample users/residents/invoices/tickets only when an explicit seed password is provided
    let usersCreated = 0;
    const existingUsersCount = await User.countDocuments({});
    if (options?.userPassword && existingUsersCount === 0) {
      const adminUser = await User.create({
        name: options.adminName ?? 'Vikramaditya Rao',
        email: options.adminEmail ?? 'admin@havenstay.in',
        phone: '+91 98450 11223',
        passwordHash: options.userPassword,
        role: 'admin',
        gender: 'male',
        occupation: 'Property Operations Manager',
        kycVerified: true,
      });

      const bed102A = createdBedsByCode.get('102-A')!;
      const bed201A = createdBedsByCode.get('201-A')!;
      const bed301A = createdBedsByCode.get('301-A')!;
      const bed201B = createdBedsByCode.get('201-B')!;

      const room102 = createdRooms.find((r) => r.roomNumber === '102')!;
      const room201 = createdRooms.find((r) => r.roomNumber === '201')!;
      const room301 = createdRooms.find((r) => r.roomNumber === '301')!;

      const residentPriya = await User.create({
        name: 'Priya Nair',
        email: 'priya.nair@havenstay.in',
        phone: '+91 97401 44556',
        passwordHash: options.userPassword,
        role: 'resident',
        gender: 'female',
        occupation: 'Product Designer at Razorpay',
        kycVerified: true,
        assignedPropertyId: property._id,
        assignedRoomId: room102._id,
        assignedBedId: bed102A._id,
        checkInDate: new Date('2026-07-01T00:00:00Z'),
        mealOptOuts: [{ date: '2026-11-24', meals: ['lunch'] }],
      });

      const residentArjun = await User.create({
        name: 'Arjun Mehta',
        email: 'arjun.mehta@havenstay.in',
        phone: '+91 99002 77889',
        passwordHash: options.userPassword,
        role: 'resident',
        gender: 'male',
        occupation: 'Backend Engineer at Swiggy',
        kycVerified: true,
        assignedPropertyId: property._id,
        assignedRoomId: room201._id,
        assignedBedId: bed201A._id,
        checkInDate: new Date('2026-05-15T00:00:00Z'),
        mealOptOuts: [{ date: '2026-11-23', meals: ['breakfast'] }],
      });

      const residentKavya = await User.create({
        name: 'Kavya Deshmukh',
        email: 'kavya.deshmukh@havenstay.in',
        phone: '+91 96112 33445',
        passwordHash: options.userPassword,
        role: 'resident',
        gender: 'female',
        occupation: 'Data Analyst at Flipkart',
        kycVerified: true,
        assignedPropertyId: property._id,
        assignedRoomId: room301._id,
        assignedBedId: bed301A._id,
        checkInDate: new Date('2026-08-01T00:00:00Z'),
        noticeEndDate: new Date('2026-12-20T00:00:00Z'),
      });

      const guestUser = await User.create({
        name: 'Ananya Sharma',
        email: 'ananya.sharma@havenstay.in',
        phone: '+91 98805 66778',
        passwordHash: options.userPassword,
        role: 'guest',
        gender: 'female',
        occupation: 'Associate PM',
        kycVerified: false,
      });

      usersCreated = 5;

      await Promise.all([
        Bed.findByIdAndUpdate(bed102A._id, {
          currentTenantId: residentPriya._id,
          checkInDate: residentPriya.checkInDate,
        }),
        Bed.findByIdAndUpdate(bed201A._id, {
          currentTenantId: residentArjun._id,
          checkInDate: residentArjun.checkInDate,
        }),
        Bed.findByIdAndUpdate(bed301A._id, {
          currentTenantId: residentKavya._id,
          checkInDate: residentKavya.checkInDate,
          noticeGivenDate: new Date('2026-11-20T00:00:00Z'),
          expectedVacateDate: new Date('2026-12-20T00:00:00Z'),
        }),
      ]);

      await Booking.create([
        {
          bookingType: 'tour',
          propertyId: property._id,
          roomId: createdRooms[0]._id,
          userId: guestUser._id,
          tourMode: 'physical',
          tourSlotDate: new Date('2026-11-25T00:00:00Z'),
          tourSlotTime: '11:00 AM',
          leadName: 'Ananya Sharma',
          leadEmail: 'ananya.sharma@havenstay.in',
          leadPhone: '+91 98805 66778',
          sharingPreference: 'single',
          moveInTimeline: 'December 1, 2026',
          status: 'confirmed',
        },
        {
          bookingType: 'tour',
          propertyId: property._id,
          tourMode: 'virtual',
          tourSlotDate: new Date('2026-11-26T00:00:00Z'),
          tourSlotTime: '05:30 PM',
          leadName: 'Siddharth Verma',
          leadEmail: 'siddharth.v@example.com',
          leadPhone: '+91 91234 56789',
          sharingPreference: 'double',
          moveInTimeline: 'Immediate',
          status: 'pending',
        },
        {
          bookingType: 'reservation',
          propertyId: property._id,
          roomId: room201._id,
          bedId: bed201B._id,
          leadName: 'Karthik Iyer',
          leadEmail: 'karthik.iyer@example.com',
          leadPhone: '+91 98451 99880',
          moveInDate: new Date('2026-12-01T00:00:00Z'),
          monthlyRent: room201.monthlyRent,
          securityDeposit: room201.securityDeposit,
          status: 'confirmed',
        },
        {
          bookingType: 'invoice',
          propertyId: property._id,
          roomId: room102._id,
          bedId: bed102A._id,
          userId: residentPriya._id,
          billingMonth: '2026-10',
          baseRent: 14500,
          electricityUnits: 98,
          electricityCharge: 882,
          mealDeduction: 0,
          gstAmount: 0,
          totalAmount: 15382,
          paymentStatus: 'paid',
          paymentGateway: 'razorpay_mock',
          transactionId: 'pay_HS202610PN881',
          paidAt: new Date('2026-10-03T10:20:00Z'),
          receiptNumber: 'HS-HRA-2026-10-014',
          hraEligible: true,
          status: 'completed',
        },
        {
          bookingType: 'invoice',
          propertyId: property._id,
          roomId: room102._id,
          bedId: bed102A._id,
          userId: residentPriya._id,
          billingMonth: '2026-11',
          baseRent: 14500,
          electricityUnits: 104,
          electricityCharge: 936,
          mealDeduction: 0,
          gstAmount: 0,
          totalAmount: 15436,
          paymentStatus: 'unpaid',
          hraEligible: true,
          status: 'pending',
        },
        {
          bookingType: 'invoice',
          propertyId: property._id,
          roomId: room201._id,
          bedId: bed201A._id,
          userId: residentArjun._id,
          billingMonth: '2026-10',
          baseRent: 14000,
          electricityUnits: 110,
          electricityCharge: 990,
          mealDeduction: 450,
          gstAmount: 0,
          totalAmount: 14540,
          paymentStatus: 'paid',
          paymentGateway: 'upi',
          transactionId: 'upi_HS202610AM402',
          paidAt: new Date('2026-10-04T18:10:00Z'),
          receiptNumber: 'HS-HRA-2026-10-019',
          hraEligible: true,
          status: 'completed',
        },
        {
          bookingType: 'invoice',
          propertyId: property._id,
          roomId: room201._id,
          bedId: bed201A._id,
          userId: residentArjun._id,
          billingMonth: '2026-11',
          baseRent: 14000,
          electricityUnits: 95,
          electricityCharge: 855,
          mealDeduction: 0,
          gstAmount: 0,
          totalAmount: 14855,
          paymentStatus: 'unpaid',
          hraEligible: true,
          status: 'pending',
        },
      ]);

      await Ticket.create([
        {
          propertyId: property._id,
          roomId: room102._id,
          residentId: residentPriya._id,
          category: 'AC',
          title: 'Split AC cooling slower than usual',
          description:
            'Airflow from the indoor unit in Room 102 feels warm after 20 minutes. Might need filter cleaning or gas check.',
          priority: 'high',
          status: 'In Progress',
          assignedStaff: 'Suresh (HVAC Technician)',
        },
        {
          propertyId: property._id,
          roomId: room201._id,
          residentId: residentArjun._id,
          category: 'Wi-Fi',
          title: 'Intermittent 5GHz packet drops near balcony desk',
          description:
            'During video calls between 4 PM and 6 PM, 5GHz SSID drops briefly in Room 201.',
          priority: 'medium',
          status: 'Open',
        },
        {
          propertyId: property._id,
          roomId: room301._id,
          residentId: residentKavya._id,
          category: 'Plumbing',
          title: 'Washroom shower diverter knob loose',
          description:
            'The diverter lever in Room 301 leaks slightly when switching to overhead shower.',
          priority: 'low',
          status: 'Resolved',
          assignedStaff: 'Mahesh (Plumber)',
          resolutionNotes: 'Replaced internal washer and tightened diverter cartridge.',
          resolvedAt: new Date('2026-11-18T14:30:00Z'),
        },
        {
          propertyId: property._id,
          roomId: room102._id,
          residentId: residentPriya._id,
          category: 'Housekeeping',
          title: 'Request extra bedsheet exchange',
          description: 'Missed Sunday linen exchange due to weekend travel.',
          priority: 'low',
          status: 'Resolved',
          assignedStaff: 'Lakshmi (Housekeeping)',
          resolutionNotes: 'Fresh linen set delivered to Room 102.',
          resolvedAt: new Date('2026-11-19T11:00:00Z'),
        },
      ]);

      console.log(`Seeded admin (${adminUser.email}), 3 residents, and 1 guest.`);
    }

    // Seed knowledge chunks if none exist
    let chunksCreated = 0;
    const existingChunks = await KnowledgeChunk.countDocuments({
      'metadata.propertyId': property._id,
    });

    if (existingChunks === 0) {
      const roomInventoryDocs: SeedKnowledgeDoc[] = createdRooms.map((room) => ({
        sourceType: 'room_inventory',
        sourceSection: `Room ${room.roomNumber} (${room.sharingType.toUpperCase()} ${
          room.isAC ? 'AC' : 'Non-AC'
        })`,
        title: `Room ${room.roomNumber} Pricing & Live Availability`,
        category: 'rooms',
        content: `Room ${room.roomNumber} on Floor ${room.floor} at ${property.name} is a ${
          room.sharingType
        }-sharing ${room.isAC ? 'AC' : 'Non-AC'} room (Gender preference: ${
          room.genderPreference
        }). Monthly rent is ₹${room.monthlyRent.toLocaleString(
          'en-IN'
        )} per bed, refundable security deposit is ₹${room.securityDeposit.toLocaleString(
          'en-IN'
        )}, lock-in period is ${room.lockInMonths} month(s), and notice period is ${
          room.noticePeriodDays
        } days. Electricity sub-meter rate is ₹${
          room.electricityRatePerUnit
        }/unit (estimated ₹${room.estimatedMonthlyElectricity}/month). Currently ${
          room.vacantBedsCount
        } out of ${room.totalBeds} bed(s) are vacant. Included amenities: ${room.amenities.join(
          ', '
        )}.`,
      }));

      const menuDocs: SeedKnowledgeDoc[] = WEEKLY_MENU.map((dayMenu) => {
        const formatItems = (items: { name: string; dietary: string }[]) =>
          items.map((i) => `${i.name} [${i.dietary.toUpperCase()}]`).join('; ');
        return {
          sourceType: 'weekly_menu',
          sourceSection: `Weekly Menu — ${dayMenu.day}`,
          title: `${dayMenu.day} Dining Menu`,
          category: 'food_menu',
          content: `${dayMenu.day} Menu at ${property.name}: Breakfast (7:30–9:45 AM): ${formatItems(
            dayMenu.breakfast
          )}. Lunch (12:30–2:30 PM): ${formatItems(
            dayMenu.lunch
          )}. Dinner (7:45–10:00 PM): ${formatItems(dayMenu.dinner)}.`,
        };
      });

      const allKnowledgeDocs = [
        ...PG_KNOWLEDGE_DOCUMENTS,
        ...roomInventoryDocs,
        ...menuDocs,
      ];

      for (const doc of allKnowledgeDocs) {
        let embedding: number[];
        try {
          embedding = await generateEmbedding(`${doc.title}\n${doc.content}`);
        } catch {
          embedding = Array(768).fill(0);
        }

        await KnowledgeChunk.create({
          content: doc.content,
          embedding,
          metadata: {
            sourceType: doc.sourceType,
            sourceSection: doc.sourceSection,
            title: doc.title,
            propertyId: property._id,
            category: doc.category,
            updatedAt: new Date(),
          },
          contentHash: computeHash(
            `${doc.sourceType}:${doc.sourceSection}:${doc.content}`
          ),
          chunkIndex: 0,
        });
        chunksCreated++;
      }
    }

    return {
      propertyId: property._id.toString(),
      roomsCount: createdRooms.length,
      bedsCount: createdBedsByCode.size,
      usersCreated,
      chunksCreated,
      embeddedWithGemini: isGeminiConfigured(),
    };
  } finally {
    if (prevSkip === undefined) {
      delete process.env.SKIP_VECTOR_HOOKS;
    } else {
      process.env.SKIP_VECTOR_HOOKS = prevSkip;
    }
  }
}
