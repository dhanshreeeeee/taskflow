import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { computeNextRun, runDueRecurringTasks } from '../utils/recurrence.js';

const createTemplateSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY']),
    assigneeIds: z.array(z.string().uuid()).min(1, 'At least one assignee is required'),
    teamId: z.string().uuid().optional().nullable(),
    weekday: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
  })
  .refine((data) => data.recurrenceType !== 'WEEKLY' || data.weekday !== undefined, {
    message: 'weekday is required for WEEKLY recurrence',
    path: ['weekday'],
  })
  .refine((data) => !['MONTHLY', 'QUARTERLY'].includes(data.recurrenceType) || data.dayOfMonth !== undefined, {
    message: 'dayOfMonth is required for MONTHLY/QUARTERLY recurrence',
    path: ['dayOfMonth'],
  });

export default async function templateRoutes(fastify) {
  // GET /recurring-templates - scoped like tasks: staff sees own team's, lead sees own team, admin sees all
  fastify.get('/recurring-templates', { preHandler: authenticate }, async (request, reply) => {
    const { role, teamId } = request.user;
    let where = {};
    if (role !== 'ADMIN') {
      where = { teamId };
    }

    const templates = await prisma.recurringTaskTemplate.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        _count: { select: { generatedTasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(templates);
  });

  // POST /recurring-templates - Lead/Admin only
  fastify.post(
    '/recurring-templates',
    { preHandler: [authenticate, requireRole(['LEAD', 'ADMIN'])] },
    async (request, reply) => {
      const parsed = createTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }
      const { title, description, priority, recurrenceType, assigneeIds, teamId: bodyTeamId, weekday, dayOfMonth } = parsed.data;
      const { sub, role, teamId: userTeamId } = request.user;

      const resolvedTeamId = role === 'ADMIN' ? (bodyTeamId ?? userTeamId ?? null) : userTeamId;

      // Lead can only set up templates for their own team
      if (role === 'LEAD') {
        const teamMembers = await prisma.user.findMany({ where: { teamId: userTeamId }, select: { id: true } });
        const validIds = new Set([...teamMembers.map((m) => m.id), sub]);
        const invalid = assigneeIds.filter((id) => !validIds.has(id));
        if (invalid.length > 0) {
          return reply.code(403).send({ error: 'Forbidden', message: 'Leads can only set default assignees within their own team' });
        }
      }

      const now = new Date();
      const nextRunAt = computeNextRun(recurrenceType, now, { weekday, dayOfMonth }) || now;

      const template = await prisma.recurringTaskTemplate.create({
        data: {
          title,
          description,
          priority,
          recurrenceType,
          assigneeIds,
          teamId: resolvedTeamId,
          weekday: weekday ?? null,
          dayOfMonth: dayOfMonth ?? null,
          nextRunAt,
          createdById: sub,
        },
      });

      return reply.code(201).send(template);
    }
  );

  // PATCH /recurring-templates/:id - pause/resume or edit
  fastify.patch(
    '/recurring-templates/:id',
    { preHandler: [authenticate, requireRole(['LEAD', 'ADMIN'])] },
    async (request, reply) => {
      const schema = z.object({
        isActive: z.boolean().optional(),
        title: z.string().min(1).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        assigneeIds: z.array(z.string().uuid()).optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }

      const existing = await prisma.recurringTaskTemplate.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: 'NotFound' });
      if (request.user.role === 'LEAD' && existing.teamId !== request.user.teamId) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const template = await prisma.recurringTaskTemplate.update({
        where: { id: request.params.id },
        data: parsed.data,
      });
      return reply.send(template);
    }
  );

  // DELETE /recurring-templates/:id
  fastify.delete(
    '/recurring-templates/:id',
    { preHandler: [authenticate, requireRole(['LEAD', 'ADMIN'])] },
    async (request, reply) => {
      const existing = await prisma.recurringTaskTemplate.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: 'NotFound' });
      if (request.user.role === 'LEAD' && existing.teamId !== request.user.teamId) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await prisma.recurringTaskTemplate.delete({ where: { id: request.params.id } });
      return reply.code(204).send();
    }
  );

  // POST /recurring-templates/run-due - manually trigger the generator (also runs automatically on an interval)
  fastify.post(
    '/recurring-templates/run-due',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request, reply) => {
      const created = await runDueRecurringTasks();
      return reply.send({ generatedCount: created.length, tasks: created });
    }
  );
}
