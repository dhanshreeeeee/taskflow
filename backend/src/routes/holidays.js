import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const holidaySchema = z.object({
  date: z.string().datetime(),
  name: z.string().min(1),
});

export default async function holidayRoutes(fastify) {
  // GET /holidays - everyone can view
  fastify.get('/holidays', { preHandler: authenticate }, async (request, reply) => {
    const { year } = request.query;
    let where = {};
    if (year) {
      where = {
        date: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${Number(year) + 1}-01-01`),
        },
      };
    }
    const holidays = await prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
    return reply.send(holidays);
  });

  // POST /holidays - Admin only
  fastify.post('/holidays', { preHandler: [authenticate, requireRole(['ADMIN'])] }, async (request, reply) => {
    const parsed = holidaySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const holiday = await prisma.holiday.create({ data: parsed.data });
    return reply.code(201).send(holiday);
  });

  // DELETE /holidays/:id - Admin only
  fastify.delete('/holidays/:id', { preHandler: [authenticate, requireRole(['ADMIN'])] }, async (request, reply) => {
    await prisma.holiday.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });
}
