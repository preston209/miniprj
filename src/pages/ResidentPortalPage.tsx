import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { Button, Card, Input, Select, Textarea } from '../components/ui/primitives.tsx';
import { api } from '../lib/api.ts';
import { formatINR, formatShortDate } from '../lib/utils.ts';
import type { InvoiceData, MealSlot, TicketData } from '../types/pg.ts';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadHraReceipt(invoice: InvoiceData, residentName: string) {
  const propName = invoice.propertyId?.name ?? 'HavenStay Koramangala Executive PG';
  const addr = invoice.propertyId?.address
    ? `${invoice.propertyId.address.line1}, ${invoice.propertyId.address.area}, ${invoice.propertyId.address.city} - ${invoice.propertyId.address.pincode}`
    : 'No. 42, 80 Feet Road, Koramangala 4th Block, Bengaluru - 560034';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>HRA Rent Receipt - ${escapeHtml(invoice.receiptNumber ?? invoice._id)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #0f172a; max-width: 680px; margin: 40px auto; padding: 24px; border: 1px solid #cbd5e1; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #0f766e; }
  p { margin: 4px 0; font-size: 13px; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { color: #475569; font-weight: 600; }
  .num { text-align: right; font-family: monospace; }
  .total td { font-weight: 700; border-top: 2px solid #0f172a; }
</style>
</head>
<body>
  <h1>${escapeHtml(propName)} — Official HRA / Rent Receipt</h1>
  <p>${escapeHtml(addr)}</p>
  <p>Receipt No: <strong>${escapeHtml(invoice.receiptNumber ?? 'PENDING')}</strong> | Billing Month: <strong>${escapeHtml(invoice.billingMonth)}</strong></p>
  <p>Received From: <strong>${escapeHtml(residentName)}</strong> (Room ${escapeHtml(invoice.roomId?.roomNumber ?? '—')}, Bed ${escapeHtml(invoice.bedId?.bedCode ?? '—')})</p>
  <table>
    <thead><tr><th>Description</th><th class="num">Amount (INR)</th></tr></thead>
    <tbody>
      <tr><td>Monthly Accommodation Rent</td><td class="num">${formatINR(invoice.baseRent)}</td></tr>
      ${
        (invoice.securityDepositCharge ?? 0) > 0
          ? `<tr><td>Refundable Security Deposit</td><td class="num">${formatINR(invoice.securityDepositCharge ?? 0)}</td></tr>`
          : ''
      }
      <tr><td>Electricity Sub-Meter (${invoice.electricityUnits} units)</td><td class="num">${formatINR(invoice.electricityCharge)}</td></tr>
      <tr><td>Meal Opt-Out Credit</td><td class="num">-${formatINR(invoice.mealDeduction)}</td></tr>
      <tr><td>GST (Residential Exemption)</td><td class="num">${formatINR(invoice.gstAmount)}</td></tr>
      <tr class="total"><td>Total Paid (${escapeHtml(invoice.paymentGateway ?? 'Online')})</td><td class="num">${formatINR(invoice.totalAmount)}</td></tr>
    </tbody>
  </table>
  <p style="margin-top:24px;">Transaction Reference: ${escapeHtml(invoice.transactionId ?? '—')} | Paid On: ${escapeHtml(formatShortDate(invoice.paidAt))}</p>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `HavenStay_HRA_Receipt_${invoice.billingMonth}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ResidentPortalPage() {
  const { user, isLoading, refetchUser } = useAuth();
  const queryClient = useQueryClient();

  const [gatewayByInvoice, setGatewayByInvoice] = useState<
    Record<string, 'razorpay_mock' | 'stripe_mock' | 'upi'>
  >({});
  const [ticketCategory, setTicketCategory] = useState<TicketData['category']>('Wi-Fi');
  const [ticketPriority, setTicketPriority] = useState<TicketData['priority']>('medium');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [mealDate, setMealDate] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
  );

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => (await api.listInvoices()).invoices ?? [],
    enabled: Boolean(user && (user.role === 'resident' || user.role === 'admin')),
  });

  const ticketsQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => (await api.listTickets()).tickets ?? [],
    enabled: Boolean(user && (user.role === 'resident' || user.role === 'admin')),
  });

  const payMutation = useMutation({
    mutationFn: ({
      id,
      gateway,
    }: {
      id: string;
      gateway: 'razorpay_mock' | 'stripe_mock' | 'upi';
    }) => api.payInvoice(id, gateway),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: api.createTicket,
    onSuccess: () => {
      setTicketTitle('');
      setTicketDesc('');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const mealOptOutMutation = useMutation({
    mutationFn: api.toggleMealOptOut,
    onSuccess: async () => {
      await refetchUser();
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">Loading resident portal...</p>
      </div>
    );
  }

  if (!user || (user.role !== 'resident' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Card className="p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900">Resident Portal</h1>
          <p className="mt-2 text-sm text-slate-600">
            Please sign in with an active resident account to view invoices, raise maintenance
            tickets, and manage meal opt-outs.
          </p>
          <Link to="/auth" className="mt-5 inline-block">
            <Button>Go to Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const assignedRoom =
    typeof user.assignedRoomId === 'object' && user.assignedRoomId !== null
      ? user.assignedRoomId
      : null;
  const assignedBed =
    typeof user.assignedBedId === 'object' && user.assignedBedId !== null
      ? user.assignedBedId
      : null;

  const currentOptOutForDate =
    user.mealOptOuts?.find((entry) => entry.date === mealDate)?.meals ?? [];

  const handleToggleMeal = (slot: MealSlot) => {
    const nextMeals = currentOptOutForDate.includes(slot)
      ? currentOptOutForDate.filter((m) => m !== slot)
      : [...currentOptOutForDate, slot];
    mealOptOutMutation.mutate({ date: mealDate, meals: nextMeals });
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketDesc.trim()) return;
    createTicketMutation.mutate({
      category: ticketCategory,
      priority: ticketPriority,
      title: ticketTitle,
      description: ticketDesc,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      {/* Resident Header Summary */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-[#0f766e]">Resident Self-Service Portal</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {assignedRoom
              ? `Room ${assignedRoom.roomNumber} · Bed ${assignedBed?.bedCode ?? '—'} · ${
                  assignedRoom.isAC ? 'AC' : 'Non-AC'
                } · Checked in ${formatShortDate(user.checkInDate)}`
              : 'Manage your invoices, maintenance tickets, and meal schedule.'}
          </p>
        </div>
        {user.noticeEndDate && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Notice period active · Scheduled checkout: {formatShortDate(user.noticeEndDate)}
          </div>
        )}
      </div>

      {/* Section 1: Rent & Utility Invoices */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[#0f766e]" />
          <h2 className="font-display text-xl font-bold text-slate-900">
            Rent & Utility Invoices
          </h2>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Base Rent</th>
                  <th className="px-4 py-3 text-right">Deposit</th>
                  <th className="px-4 py-3 text-right">Electricity</th>
                  <th className="px-4 py-3 text-right">Credits</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoicesQuery.data ?? []).map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 font-mono-tabular font-medium text-slate-900">
                      {inv.billingMonth}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-slate-700">
                      {formatINR(inv.baseRent)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-slate-700">
                      {(inv.securityDepositCharge ?? 0) > 0
                        ? formatINR(inv.securityDepositCharge ?? 0)
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-slate-700">
                      {formatINR(inv.electricityCharge)} ({inv.electricityUnits}u)
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-emerald-700">
                      -{formatINR(inv.mealDeduction)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular font-semibold text-slate-900">
                      {formatINR(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5">
                      {inv.paymentStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Paid
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-700">Unpaid</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {inv.paymentStatus === 'paid' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadHraReceipt(inv, user.name)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          HRA Receipt
                        </Button>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <Select
                            className="h-9 w-36 text-xs"
                            value={gatewayByInvoice[inv._id] ?? 'razorpay_mock'}
                            onChange={(e) =>
                              setGatewayByInvoice((prev) => ({
                                ...prev,
                                [inv._id]: e.target.value as
                                  | 'razorpay_mock'
                                  | 'stripe_mock'
                                  | 'upi',
                              }))
                            }
                          >
                            <option value="razorpay_mock">Razorpay (Test)</option>
                            <option value="stripe_mock">Stripe (Test)</option>
                            <option value="upi">UPI Instant</option>
                          </Select>
                          <Button
                            size="sm"
                            disabled={payMutation.isPending}
                            onClick={() =>
                              payMutation.mutate({
                                id: inv._id,
                                gateway: gatewayByInvoice[inv._id] ?? 'razorpay_mock',
                              })
                            }
                          >
                            Pay {formatINR(inv.totalAmount)}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!invoicesQuery.isLoading && (invoicesQuery.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                      No invoices generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Section 2 & 3: Meal Opt-Out Toggle + Maintenance Ticketing */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Meal Opt-Out */}
        <Card className="space-y-5 p-6 lg:col-span-5">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-[#0f766e]" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Daily Meal Opt-Out Toggle
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Going out for work or traveling? Opt out at least 4 hours ahead to reduce food waste
            and earn ₹45/meal sustainability credits.
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Select Date</label>
            <Input
              type="date"
              value={mealDate}
              onChange={(e) => setMealDate(e.target.value)}
            />
          </div>

          <div className="space-y-2.5">
            {(
              [
                { slot: 'breakfast' as const, label: 'Breakfast', time: '7:30 – 9:45 AM' },
                { slot: 'lunch' as const, label: 'Lunch', time: '12:30 – 2:30 PM' },
                { slot: 'dinner' as const, label: 'Dinner', time: '7:45 – 10:00 PM' },
              ] as const
            ).map(({ slot, label, time }) => {
              const isOptedOut = currentOptOutForDate.includes(slot);
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="font-mono-tabular text-xs text-slate-500">{time}</p>
                  </div>
                  <button
                    type="button"
                    disabled={mealOptOutMutation.isPending}
                    onClick={() => handleToggleMeal(slot)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      isOptedOut
                        ? 'border border-amber-300 bg-amber-50 text-amber-800'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {isOptedOut ? 'Opted Out' : 'Eating In'}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Maintenance Ticketing */}
        <Card className="space-y-5 p-6 lg:col-span-7">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-[#0f766e]" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Maintenance Requests
            </h2>
          </div>

          <form
            onSubmit={handleCreateTicket}
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value as TicketData['category'])}
              >
                <option value="Wi-Fi">Wi-Fi & Network</option>
                <option value="AC">AC & Cooling</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Electrical">Electrical</option>
                <option value="Other">Other</option>
              </Select>
              <Select
                value={ticketPriority}
                onChange={(e) => setTicketPriority(e.target.value as TicketData['priority'])}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <Input
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder="Short summary (e.g., Slow 5GHz Wi-Fi near desk)"
              required
            />
            <Textarea
              rows={2}
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              placeholder="Describe the issue and convenient access hours..."
              required
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={createTicketMutation.isPending}>
                {createTicketMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </form>

          <div className="divide-y divide-slate-100">
            {(ticketsQuery.data ?? []).map((t) => (
              <div key={t._id} className="py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {t.category} · {t.priority.toUpperCase()} priority ·{' '}
                      {formatShortDate(t.createdAt)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{t.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{t.description}</p>
                    {t.resolutionNotes && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
                        <FileText className="h-3.5 w-3.5" />
                        Resolution: {t.resolutionNotes}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      t.status === 'Resolved'
                        ? 'text-emerald-700'
                        : t.status === 'In Progress'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
            {!ticketsQuery.isLoading && (ticketsQuery.data ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                No maintenance tickets raised yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
