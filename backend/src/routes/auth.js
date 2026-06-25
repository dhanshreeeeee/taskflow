import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['STAFF', 'LEAD', 'ADMIN']).default('STAFF'),
  teamId: z.string().uuid().nullable().optional(),
});

export default async function authRoutes(fastify) {
  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'InvalidCredentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'InvalidCredentials' });
    }

    const token = fastify.jwt.sign(
      { sub: user.id, role: user.role, teamId: user.teamId },
      { expiresIn: '12h' }
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
      },
    });
  });

  // GET /auth/me
  fastify.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        isActive: true,
        team: { select: { id: true, name: true } },
        leadOfTeam: { select: { id: true, name: true } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'NotFound' });
    return reply.send(user);
  });

  // POST /auth/users - Admin creates a new user (staff/lead/admin)
  fastify.post(
    '/auth/users',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request, reply) => {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }
      const { name, email, password, role, teamId } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.code(409).send({ error: 'EmailTaken' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { name, email, passwordHash, role, teamId: teamId ?? null },
      });

      return reply.code(201).send({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
      });
    }
  );

  // GET /auth/users - Admin lists all users; Lead lists their team
  fastify.get('/auth/users', { preHandler: authenticate }, async (request, reply) => {
    const { role, sub, teamId } = request.user;

    let where = {};
    if (role === 'LEAD') {
      where = { teamId };
    } else if (role === 'STAFF') {
      where = { id: sub };
    }
    // ADMIN sees everyone (where = {})

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        isActive: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return reply.send(users);
  });

  // PATCH /auth/users/:id - Admin updates role/team/active status
  fastify.patch(
    '/auth/users/:id',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request, reply) => {
      const { id } = request.params;
      const schema = z.object({
        role: z.enum(['STAFF', 'LEAD', 'ADMIN']).optional(),
        teamId: z.string().uuid().nullable().optional(),
        isActive: z.boolean().optional(),
        name: z.string().min(1).optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }

      const user = await prisma.user.update({
        where: { id },
        data: parsed.data,
      });
      return reply.send(user);
    }
  );
}
