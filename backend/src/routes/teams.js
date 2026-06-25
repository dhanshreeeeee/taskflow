import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const teamSchema = z.object({
  name: z.string().min(1),
  leadId: z.string().uuid().nullable().optional(),
});

export default async function teamRoutes(fastify) {
  // GET /teams - everyone can view (staff sees own team only, lead sees own, admin sees all)
  fastify.get('/teams', { preHandler: authenticate }, async (request, reply) => {
    const { role, teamId } = request.user;
    let where = {};
    if (role !== 'ADMIN') {
      where = { id: teamId ?? undefined };
    }

    const teams = await prisma.team.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, email: true } },
        members: { select: { id: true, name: true, email: true, isActive: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { name: 'asc' },
    });
    return reply.send(teams);
  });

  // POST /teams - Admin only
  fastify.post('/teams', { preHandler: [authenticate, requireRole(['ADMIN'])] }, async (request, reply) => {
    const parsed = teamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const team = await prisma.team.create({ data: parsed.data });
    return reply.code(201).send(team);
  });

  // PATCH /teams/:id - Admin only (reassign lead, rename)
  fastify.patch('/teams/:id', { preHandler: [authenticate, requireRole(['ADMIN'])] }, async (request, reply) => {
    const { id } = request.params;
    const parsed = teamSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const team = await prisma.team.update({ where: { id }, data: parsed.data });
    return reply.send(team);
  });
}
