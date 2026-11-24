import type { Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { Property } from '../models/Property.ts';
import { Ticket } from '../models/Ticket.ts';

const createTicketSchema = z.object({
  category: z.enum(['Wi-Fi', 'Plumbing', 'Housekeeping', 'AC', 'Electrical', 'Other']),
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(5).max(1500),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const updateTicketSchema = z.object({
  status: z.enum(['Open', 'In Progress', 'Resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedStaff: z.string().trim().max(100).optional(),
  resolutionNotes: z.string().trim().max(1000).optional(),
});

export async function listTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const filter: Record<string, unknown> = {};
  if (req.user.role !== 'admin') {
    filter.residentId = req.user._id;
  }

  const tickets = await Ticket.find(filter)
    .populate('residentId', 'name email phone')
    .populate('roomId', 'roomNumber floor')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ tickets });
}

export async function createTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid maintenance ticket details.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  let propertyId = req.user.assignedPropertyId;
  if (!propertyId) {
    const primary = await Property.findOne({ isActive: true }).select('_id').lean();
    if (!primary) {
      res.status(404).json({ error: 'No active PG property found.' });
      return;
    }
    propertyId = primary._id;
  }

  const ticket = await Ticket.create({
    propertyId,
    roomId: req.user.assignedRoomId ?? null,
    residentId: req.user._id,
    category: parsed.data.category,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority,
    status: 'Open',
  });

  res.status(201).json({
    message: 'Maintenance ticket submitted.',
    ticket,
  });
}

export async function updateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid ticket ID.' });
    return;
  }

  const parsed = updateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid ticket update payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const ticket = await Ticket.findById(id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (parsed.data.status) {
    ticket.status = parsed.data.status;
    if (parsed.data.status === 'Resolved' && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    } else if (parsed.data.status !== 'Resolved') {
      ticket.resolvedAt = null;
    }
  }
  if (parsed.data.priority) ticket.priority = parsed.data.priority;
  if (parsed.data.assignedStaff !== undefined) ticket.assignedStaff = parsed.data.assignedStaff;
  if (parsed.data.resolutionNotes !== undefined) {
    ticket.resolutionNotes = parsed.data.resolutionNotes;
  }

  await ticket.save();

  res.json({
    message: 'Maintenance ticket updated.',
    ticket,
  });
}
