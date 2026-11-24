import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Database, FileJson, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api.ts';
import type { PropertyData } from '../../types/pg.ts';
import { Button, Card, Input, Select, Textarea } from '../ui/primitives.tsx';

const STARTER_IMPORT_TEMPLATE = {
  property: {
    name: 'My Real Executive PG',
    tagline: 'Furnished co-living near Metro & IT corridor',
    description:
      'Managed paying guest residence with furnished rooms, homestyle meals, fiber Wi-Fi, and sub-meter billing.',
    address: {
      line1: 'No. 18, Main Road',
      area: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560008',
      landmarks: ['Metro Station (400m)', 'Tech Park Bus Stop (250m)'],
    },
    googleMapsUrl: 'https://maps.google.com/?q=Indiranagar+Bengaluru',
    contactPhone: '+91 98450 00000',
    contactEmail: 'hello@yourpg.in',
    genderPolicy: 'co-ed',
    electricityRatePerUnit: 9,
    amenities: [
      '300 Mbps Fiber Wi-Fi',
      '24/7 Biometric Entry',
      '3 Fresh Homestyle Meals Daily',
      'DG Power Backup',
    ],
    houseRulesSummary: {
      curfewTime: '11:30 PM (Digital late-entry pass available)',
      visitorHours: '9:00 AM – 8:00 PM in lounge',
      overnightGuestPolicy: 'Prior admin approval required',
      quietHours: '11:00 PM – 6:30 AM',
      smokingAlcoholPolicy: 'Strictly smoke-free and alcohol-free premises',
      securityDepositRefundDays: 7,
      gstRatePercent: 0,
    },
    mealTimings: {
      breakfast: '7:30 AM – 9:45 AM',
      lunch: '12:30 PM – 2:30 PM',
      dinner: '7:45 PM – 10:00 PM',
    },
  },
  rooms: [
    {
      roomNumber: '101',
      floor: 1,
      sharingType: 'single',
      isAC: true,
      genderPreference: 'any',
      monthlyRent: 21000,
      securityDeposit: 25000,
      lockInMonths: 1,
      noticePeriodDays: 30,
      electricityRatePerUnit: 9,
      estimatedMonthlyElectricity: 1200,
      amenities: ['Split AC', 'Study Desk', 'Wardrobe'],
      description: 'Private single studio with ergonomic study desk.',
    },
    {
      roomNumber: '102',
      floor: 1,
      sharingType: 'double',
      isAC: true,
      genderPreference: 'female',
      monthlyRent: 14000,
      securityDeposit: 20000,
      lockInMonths: 2,
      noticePeriodDays: 30,
      electricityRatePerUnit: 9,
      estimatedMonthlyElectricity: 900,
      amenities: ['Split AC', 'Attached Bath', '2 Wardrobes'],
      description: 'Twin-sharing AC suite on female wing.',
    },
  ],
  weeklyMenu: [
    {
      day: 'Monday',
      breakfast: [{ name: 'Idli, Vada & Chutney', dietary: 'veg' }],
      lunch: [{ name: 'Phulka, Jeera Rice, Dal Tadka & Mix Veg', dietary: 'veg' }],
      dinner: [{ name: 'Chapati, Paneer Butter Masala & Rice', dietary: 'veg' }],
    },
  ],
  knowledgeDocuments: [
    {
      sourceType: 'neighborhood_guide',
      sourceSection: 'Local Commute Guide',
      title: 'Transit & Local Essentials',
      category: 'neighborhood',
      content: '400m from Metro station with direct transit to major tech corridors.',
    },
  ],
};

export function PropertyAndImportTab({ property }: { property: PropertyData | null }) {
  const queryClient = useQueryClient();

  // Property Form State
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [line1, setLine1] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmarksText, setLandmarksText] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [genderPolicy, setGenderPolicy] = useState<PropertyData['genderPolicy']>('co-ed');
  const [electricityRate, setElectricityRate] = useState(9);
  const [amenitiesText, setAmenitiesText] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');

  // House Rules Summary State
  const [curfewTime, setCurfewTime] = useState('11:30 PM (Digital late-entry pass available)');
  const [visitorHours, setVisitorHours] = useState('9:00 AM – 8:00 PM in lounge');
  const [overnightGuestPolicy, setOvernightGuestPolicy] = useState(
    'Prior admin approval required'
  );
  const [quietHours, setQuietHours] = useState('11:00 PM – 6:30 AM');
  const [smokingAlcoholPolicy, setSmokingAlcoholPolicy] = useState(
    'Strictly smoke-free and alcohol-free premises'
  );
  const [refundDays, setRefundDays] = useState(7);
  const [gstPercent, setGstPercent] = useState(0);

  const [propNotice, setPropNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Import & Sample Reset State
  const [importJsonText, setImportJsonText] = useState('');
  const [markdownRules, setMarkdownRules] = useState('');
  const [markdownTitle, setMarkdownTitle] = useState('Official PG Rulebook');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [confirmClearStep, setConfirmClearStep] = useState(false);
  const [importNotice, setImportNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!property) {
      setName('');
      setTagline('');
      setDescription('');
      setLine1('');
      setArea('');
      setCity('');
      setStateName('');
      setPincode('');
      setLandmarksText('');
      setGoogleMapsUrl('');
      setContactPhone('');
      setContactEmail('');
      setGenderPolicy('co-ed');
      setElectricityRate(9);
      setAmenitiesText('');
      setHeroImageUrl('');
      return;
    }

    setName(property.name);
    setTagline(property.tagline ?? '');
    setDescription(property.description);
    setLine1(property.address.line1);
    setArea(property.address.area);
    setCity(property.address.city);
    setStateName(property.address.state);
    setPincode(property.address.pincode);
    setLandmarksText((property.address.landmarks ?? []).join(', '));
    setGoogleMapsUrl(property.googleMapsUrl ?? '');
    setContactPhone(property.contactPhone);
    setContactEmail(property.contactEmail);
    setGenderPolicy(property.genderPolicy);
    setElectricityRate(property.electricityRatePerUnit ?? 9);
    setAmenitiesText((property.amenities ?? []).join(', '));
    setHeroImageUrl(property.heroImageUrl ?? '');
    if (property.houseRulesSummary) {
      setCurfewTime(property.houseRulesSummary.curfewTime);
      setVisitorHours(property.houseRulesSummary.visitorHours);
      setOvernightGuestPolicy(property.houseRulesSummary.overnightGuestPolicy);
      setQuietHours(property.houseRulesSummary.quietHours);
      setSmokingAlcoholPolicy(property.houseRulesSummary.smokingAlcoholPolicy);
      setRefundDays(property.houseRulesSummary.securityDepositRefundDays);
      setGstPercent(property.houseRulesSummary.gstRatePercent);
    }
  }, [property]);

  const invalidateAllPgData = () => {
    queryClient.invalidateQueries({ queryKey: ['property', 'primary'] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'beds'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'residents'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'tours'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const savePropertyMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        address: {
          line1: line1.trim(),
          area: area.trim(),
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
          landmarks: landmarksText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        ...(googleMapsUrl.trim() ? { googleMapsUrl: googleMapsUrl.trim() } : {}),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        genderPolicy,
        electricityRatePerUnit: Number(electricityRate) || 0,
        amenities: amenitiesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        ...(heroImageUrl.trim() ? { heroImageUrl: heroImageUrl.trim() } : {}),
        houseRulesSummary: {
          curfewTime: curfewTime.trim(),
          visitorHours: visitorHours.trim(),
          overnightGuestPolicy: overnightGuestPolicy.trim(),
          quietHours: quietHours.trim(),
          smokingAlcoholPolicy: smokingAlcoholPolicy.trim(),
          securityDepositRefundDays: Number(refundDays) || 7,
          gstRatePercent: Number(gstPercent) || 0,
        },
      };

      if (property) {
        return api.updateProperty(property._id, payload);
      }
      return api.createProperty(payload);
    },
    onSuccess: (res) => {
      setPropNotice({ type: 'ok', text: res.message });
      invalidateAllPgData();
    },
    onError: (err) => {
      setPropNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save property details.',
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: api.importRealPgData,
    onSuccess: (res) => {
      setImportNotice({ type: 'ok', text: res.message });
      invalidateAllPgData();
    },
    onError: (err) => {
      setImportNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Import failed. Verify JSON schema.',
      });
    },
  });

  const clearSampleMutation = useMutation({
    mutationFn: api.resetSampleData,
    onSuccess: (res) => {
      setConfirmClearStep(false);
      setImportNotice({ type: 'ok', text: res.message });
      invalidateAllPgData();
    },
    onError: (err) => {
      setConfirmClearStep(false);
      setImportNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to clear sample data.',
      });
    },
  });

  const handleJsonFilePick = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setImportJsonText(text);
  };

  const handleMarkdownFilePick = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setMarkdownRules(text);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportNotice(null);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(importJsonText);
    } catch {
      setImportNotice({ type: 'err', text: 'Invalid JSON syntax. Please check your JSON input.' });
      return;
    }

    importMutation.mutate({
      data: parsedJson,
      ...(markdownRules.trim() ? { markdownRules: markdownRules.trim() } : {}),
      ...(markdownTitle.trim() ? { markdownTitle: markdownTitle.trim() } : {}),
      replaceExisting,
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Left: Property Details & Policy Editor */}
      <Card className="p-6 lg:col-span-7">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <Building2 className="h-5 w-5 text-[#0f766e]" />
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {property ? 'Property Profile & Terms' : 'Create Primary PG Property'}
            </h2>
            <p className="text-xs text-slate-500">
              Saving automatically updates MongoDB and syncs rules/pricing into RAG embeddings.
            </p>
          </div>
        </div>

        {propNotice && (
          <div
            className={`mt-4 rounded-lg border px-4 py-2.5 text-xs font-medium ${
              propNotice.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {propNotice.text}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPropNotice(null);
            savePropertyMutation.mutate();
          }}
          className="mt-4 space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Property Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="GreenNest Executive Living"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Tagline</label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Steps from Indiranagar Metro"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Overview of rooms, meals, security, and co-working amenities..."
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Street Address
              </label>
              <Input
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="No. 18, 12th Main Road"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Locality / Area
              </label>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Indiranagar"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">City</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">State</label>
              <Input
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="Karnataka"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Pincode</label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="560008"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Landmarks (comma-separated)
              </label>
              <Input
                value={landmarksText}
                onChange={(e) => setLandmarksText(e.target.value)}
                placeholder="Metro Station (450m), 100ft Road"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Google Maps URL
              </label>
              <Input
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=..."
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Contact Phone
              </label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98450 00000"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Contact Email
              </label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@yourpg.in"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Gender Policy
              </label>
              <Select
                value={genderPolicy}
                onChange={(e) =>
                  setGenderPolicy(e.target.value as PropertyData['genderPolicy'])
                }
              >
                <option value="co-ed">Co-Ed</option>
                <option value="female-only">Female Only</option>
                <option value="male-only">Male Only</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Sub-Meter Rate (₹/unit)
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
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Deposit Refund (Days)
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                value={refundDays}
                onChange={(e) => setRefundDays(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Property Amenities (comma-separated)
            </label>
            <Input
              value={amenitiesText}
              onChange={(e) => setAmenitiesText(e.target.value)}
              placeholder="300 Mbps Fiber Wi-Fi, 24/7 Biometric Entry, DG Backup, Washing Machines"
            />
          </div>

          <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Curfew Time</label>
              <Input value={curfewTime} onChange={(e) => setCurfewTime(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Visitor Hours
              </label>
              <Input value={visitorHours} onChange={(e) => setVisitorHours(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Overnight Guest Policy
              </label>
              <Input
                value={overnightGuestPolicy}
                onChange={(e) => setOvernightGuestPolicy(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Quiet Hours</label>
              <Input value={quietHours} onChange={(e) => setQuietHours(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Smoke & Alcohol Policy
              </label>
              <Input
                value={smokingAlcoholPolicy}
                onChange={(e) => setSmokingAlcoholPolicy(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                GST Rate (%) & Hero Image URL
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  min={0}
                  max={28}
                  value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value))}
                  aria-label="GST percent"
                />
                <Input
                  className="col-span-2"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="/src/assets/... or https://..."
                  aria-label="Hero image URL"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={savePropertyMutation.isPending}>
              {savePropertyMutation.isPending
                ? 'Saving & Syncing RAG...'
                : property
                ? 'Save Property & Sync RAG'
                : 'Create Property'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Right: Real PG JSON/Markdown Importer & Sample Data Reset */}
      <div className="space-y-6 lg:col-span-5">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-[#0f766e]" />
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Import Real PG Dataset (JSON + Markdown)
                </h3>
                <p className="text-xs text-slate-500">
                  Loads property, rooms, beds, menu & builds fresh 768d Gemini embeddings.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportJsonText(JSON.stringify(STARTER_IMPORT_TEMPLATE, null, 2))}
            >
              Load Starter
            </Button>
          </div>

          {importNotice && (
            <div
              className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                importNotice.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {importNotice.text}
            </div>
          )}

          <form onSubmit={handleImportSubmit} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Upload JSON File (or paste below)
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleJsonFilePick(e.target.files?.[0])}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
              />
            </div>

            <Textarea
              rows={7}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='Paste JSON matching server/data/real-pg-template.json...'
              className="font-mono-tabular text-xs"
              required
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Optional Rulebook Title
                </label>
                <Input
                  value={markdownTitle}
                  onChange={(e) => setMarkdownTitle(e.target.value)}
                  placeholder="Official PG Rulebook"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Attach .md / .txt Rules
                </label>
                <input
                  type="file"
                  accept=".md,.txt"
                  onChange={(e) => handleMarkdownFilePick(e.target.files?.[0])}
                  className="block w-full pt-1.5 text-xs text-slate-600 file:mr-2 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
                />
              </div>
            </div>

            <Textarea
              rows={3}
              value={markdownRules}
              onChange={(e) => setMarkdownRules(e.target.value)}
              placeholder="Optional Markdown house rules (deposit refund, notice, visitors, curfew)..."
              className="text-xs"
            />

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#0f766e]"
              />
              Replace existing sample/non-admin PG records before importing
            </label>

            <Button type="submit" className="w-full" disabled={importMutation.isPending}>
              <Database className="h-4 w-4" />
              {importMutation.isPending ? 'Importing & Embedding...' : 'Import Real PG & Sync RAG'}
            </Button>
          </form>
        </Card>

        {/* Danger Zone: Clear Sample Data */}
        <Card className="border-amber-200 bg-amber-50/40 p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-2">
              <h3 className="font-display text-base font-bold text-slate-900">
                Reset / Clear Sample Data
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Removes sample properties, rooms, beds, tours, invoices, tickets, non-admin
                users, and vector chunks while preserving your admin account.
              </p>

              {!confirmClearStep ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClearStep(true)}
                  className="border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  Clear Sample Data...
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={clearSampleMutation.isPending}
                    onClick={() => clearSampleMutation.mutate()}
                  >
                    {clearSampleMutation.isPending
                      ? 'Clearing...'
                      : 'Confirm Clear (Keeps Admin)'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmClearStep(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
