import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const leaveRequestSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().optional(),
});

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
});

export default async function leaveRoutes(fastify) {
  // GET /leave - staff sees own, lead sees team's, admin sees all
  fastify.get('/leave', { preHandler: authenticate }, async (request, reply) => {
    const { sub, role, teamId } = request.user;
    const { status } = request.query;

    let where = {};
    if (role === 'STAFF') {
      where = { userId: sub };
    } else if (role === 'LEAD') {
      // team members' leave + the lead's own leave
      where = {
        OR: [{ user: { teamId } }, { userId: sub }],
      };
    }
    // ADMIN: sees all, including leads' own leave (which leads submit for admin approval)

    if (status) where.status = status;

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true, teamId: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    return reply.send(leaves);
  });

  // POST /leave - apply for leave
  fastify.post('/leave', { preHandler: authenticate }, async (request, reply) => {
    const parsed = leaveRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const { startDate, endDate, reason } = parsed.data;
    const { sub } = request.user;

    if (new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'ValidationError', message: 'startDate must be before endDate' });
    }

    const leave = await prisma.leaveRequest.create({
      data: { userId: sub, startDate, endDate, reason },
      include: { user: { select: { id: true, name: true, role: true, teamId: true } } },
    });
    return reply.code(201).send(leave);
  });

  // POST /leave/:id/review - Lead approves Staff leave; Admin approves Lead leave
  fastify.post(
    '/leave/:id/review',
    { preHandler: [authenticate, requireRole(['LEAD', 'ADMIN'])] },
    async (request, reply) => {
      const parsed = reviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }
      const { decision, note } = parsed.data;
      const { sub, role, teamId } = request.user;

      const leave = await prisma.leaveRequest.findUnique({
        where: { id: request.params.id },
        include: { user: true },
      });
      if (!leave) return reply.code(404).send({ error: 'NotFound' });

      // Authorization: Lead can only review their own team's STAFF leave; Admin reviews anyone (esp. Leads)
      if (role === 'LEAD') {
        if (leave.user.role !== 'STAFF' || leave.user.teamId !== teamId) {
          return reply.code(403).send({
            error: 'Forbidden',
            message: 'Leads can only approve leave for staff in their own team',
          });
        }
      }
      if (leave.status !== 'PENDING') {
        return reply.code(400).send({ error: 'InvalidState', message: 'Leave request already resolved' });
      }

      const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: { status: newStatus, reviewedById: sub, reviewNote: note ?? null, reviewedAt: new Date() },
        include: { user: { select: { id: true, name: true, role: true, teamId: true } } },
      });

      // On approval, surface this person's open tasks so the Lead can reassign them
      let flaggedTasks = [];
      if (decision === 'APPROVE') {
        flaggedTasks = await prisma.task.findMany({
          where: {
            assignees: { some: { userId: leave.userId } },
            status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED'] },
          },
          include: {
            assignees: { include: { assignee: { select: { id: true, name: true } } } },
          },
        });
      }

      return reply.send({ leave: updated, flaggedTasksForReassignment: flaggedTasks });
    }
  );

  // DELETE /leave/:id - cancel own pending leave request
  fastify.delete('/leave/:id', { preHandler: authenticate }, async (request, reply) => {
    const { sub } = request.user;
    const leave = await prisma.leaveRequest.findUnique({ where: { id: request.params.id } });
    if (!leave) return reply.code(404).send({ error: 'NotFound' });
    if (leave.userId !== sub) return reply.code(403).send({ error: 'Forbidden' });
    if (leave.status !== 'PENDING') {
      return reply.code(400).send({ error: 'InvalidState', message: 'Only pending requests can be cancelled' });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: 'CANCELLED' },
    });
    return reply.send(updated);
  });

  // GET /leave/on-leave-today - quick lookup for "who's out" widget, used to flag tasks
  fastify.get('/leave/on-leave-today', { preHandler: authenticate }, async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { role, teamId } = request.user;
    let userFilter = {};
    if (role === 'LEAD') userFilter = { teamId };

    const onLeave = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lt: tomorrow },
        endDate: { gte: today },
        user: userFilter,
      },
      include: { user: { select: { id: true, name: true, teamId: true } } },
    });
    return reply.send(onLeave);
  });
}
