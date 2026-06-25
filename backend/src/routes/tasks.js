import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).min(1, 'At least one assignee is required'),
  teamId: z.string().uuid().optional().nullable(),
  recurrenceType: z.enum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY']).default('ONE_TIME'),
});

const updateStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED', 'DONE', 'BLOCKED']),
});

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
});

const transferRequestSchema = z.object({
  toUserId: z.string().uuid(),
  reason: z.string().optional(),
});

const transferReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
});

const commentSchema = z.object({
  body: z.string().min(1),
});

async function logActivity(taskId, actorId, action, fromValue = null, toValue = null) {
  return prisma.taskActivity.create({
    data: { taskId, actorId, action, fromValue, toValue },
  });
}

// Helper: can this user act on this task (creator, assignee, their lead, or admin)?
async function userCanAccessTask(task, requestUser) {
  const { sub, role, teamId } = requestUser;
  if (role === 'ADMIN') return true;
  if (task.createdById === sub) return true;
  if (task.assignees.some((a) => a.userId === sub)) return true;
  if (role === 'LEAD' && task.teamId === teamId) return true;
  return false;
}

const taskInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  team: { select: { id: true, name: true } },
  template: { select: { id: true, title: true, recurrenceType: true } },
  assignees: { include: { assignee: { select: { id: true, name: true, email: true, isActive: true } } } },
  comments: {
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  activity: {
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  transferRequests: {
    include: {
      requestedBy: { select: { id: true, name: true } },
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
};

export default async function taskRoutes(fastify) {
  // GET /tasks - scoped by role: staff sees their own (created or assigned), lead sees team, admin sees all
  fastify.get('/tasks', { preHandler: authenticate }, async (request, reply) => {
    const { sub, role, teamId } = request.user;
    const { status, teamId: filterTeamId, recurrenceType } = request.query;

    let where = {};
    if (role === 'STAFF') {
      where = {
        OR: [{ createdById: sub }, { assignees: { some: { userId: sub } } }],
      };
    } else if (role === 'LEAD') {
      where = { teamId };
    }
    // ADMIN: no restriction

    if (status) where.status = status;
    if (filterTeamId && role === 'ADMIN') where.teamId = filterTeamId;
    if (recurrenceType) where.recurrenceType = recurrenceType;

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
    return reply.send(tasks);
  });

  // GET /tasks/:id
  fastify.get('/tasks/:id', { preHandler: authenticate }, async (request, reply) => {
    const task = await prisma.task.findUnique({
      where: { id: request.params.id },
      include: taskInclude,
    });
    if (!task) return reply.code(404).send({ error: 'NotFound' });

    if (!(await userCanAccessTask(task, request.user))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    return reply.send(task);
  });

  // POST /tasks - create + assign (Staff can create & self-assign or assign to teammates; Lead/Admin assign anyone in scope)
  fastify.post('/tasks', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const { title, description, priority, dueDate, assigneeIds, teamId: bodyTeamId, recurrenceType } = parsed.data;
    const { sub, role, teamId: userTeamId } = request.user;

    // Determine the task's team context
    let resolvedTeamId = bodyTeamId ?? userTeamId ?? null;

    // Staff can only assign within their own team (or to themselves)
    if (role === 'STAFF') {
      const disallowed = assigneeIds.some((id) => id !== sub);
      if (disallowed) {
        // allow assigning to teammates too - verify they're in the same team
        const teammates = await prisma.user.findMany({
          where: { id: { in: assigneeIds }, teamId: userTeamId },
          select: { id: true },
        });
        const teammateIds = new Set(teammates.map((t) => t.id));
        const invalid = assigneeIds.filter((id) => id !== sub && !teammateIds.has(id));
        if (invalid.length > 0) {
          return reply.code(403).send({
            error: 'Forbidden',
            message: 'Staff can only assign tasks to themselves or teammates',
          });
        }
      }
      resolvedTeamId = userTeamId;
    } else if (role === 'LEAD') {
      const teamMembers = await prisma.user.findMany({
        where: { teamId: userTeamId },
        select: { id: true },
      });
      const validIds = new Set([...teamMembers.map((m) => m.id), sub]);
      const invalid = assigneeIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Leads can only assign tasks within their own team',
        });
      }
      resolvedTeamId = userTeamId;
    }
    // ADMIN: no restriction, can assign anyone, any team

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        dueDate: dueDate ?? null,
        recurrenceType,
        createdById: sub,
        teamId: resolvedTeamId,
        assignees: {
          create: assigneeIds.map((userId) => ({ userId })),
        },
      },
      include: taskInclude,
    });

    await logActivity(task.id, sub, 'CREATED', null, title);
    for (const uid of assigneeIds) {
      await logActivity(task.id, sub, 'ASSIGNED', null, uid);
    }

    const fullTask = await prisma.task.findUnique({ where: { id: task.id }, include: taskInclude });
    return reply.code(201).send(fullTask);
  });

  // PATCH /tasks/:id/status - assignee moves task through workflow
  fastify.patch('/tasks/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const { status: newStatus } = parsed.data;
    const { sub, role } = request.user;

    const task = await prisma.task.findUnique({ where: { id: request.params.id }, include: taskInclude });
    if (!task) return reply.code(404).send({ error: 'NotFound' });
    if (!(await userCanAccessTask(task, request.user))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Only Lead/Admin can move a task to DONE directly (bypass review); assignees move to IN_REVIEW
    if (newStatus === 'DONE' && role === 'STAFF') {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Staff must submit for review (IN_REVIEW) rather than marking Done directly',
      });
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { status: newStatus },
      include: taskInclude,
    });
    await logActivity(task.id, sub, 'STATUS_CHANGE', task.status, newStatus);

    return reply.send(updated);
  });

  // POST /tasks/:id/review - Lead/Admin approves or rejects an IN_REVIEW task
  fastify.post(
    '/tasks/:id/review',
    { preHandler: [authenticate, requireRole(['LEAD', 'ADMIN'])] },
    async (request, reply) => {
      const parsed = reviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }
      const { decision, note } = parsed.data;
      const { sub } = request.user;

      const task = await prisma.task.findUnique({ where: { id: request.params.id } });
      if (!task) return reply.code(404).send({ error: 'NotFound' });
      if (!(await userCanAccessTask(task, request.user))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      if (task.status !== 'IN_REVIEW') {
        return reply.code(400).send({ error: 'InvalidState', message: 'Task is not currently in review' });
      }

      const newStatus = decision === 'APPROVE' ? 'DONE' : 'CHANGES_REQUESTED';
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: {
          status: newStatus,
          reviewedById: sub,
          reviewNote: note ?? null,
          reviewedAt: new Date(),
        },
        include: taskInclude,
      });
      await logActivity(task.id, sub, 'REVIEWED', 'IN_REVIEW', newStatus);

      return reply.send(updated);
    }
  );

  // POST /tasks/:id/comments
  fastify.post('/tasks/:id/comments', { preHandler: authenticate }, async (request, reply) => {
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const task = await prisma.task.findUnique({ where: { id: request.params.id }, include: taskInclude });
    if (!task) return reply.code(404).send({ error: 'NotFound' });
    if (!(await userCanAccessTask(task, request.user))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const comment = await prisma.taskComment.create({
      data: { taskId: task.id, authorId: request.user.sub, body: parsed.data.body },
      include: { author: { select: { id: true, name: true } } },
    });
    return reply.code(201).send(comment);
  });

  // --- TRANSFER REQUESTS ---

  // POST /tasks/:id/transfer-requests - assignee requests handing task to someone else
  fastify.post('/tasks/:id/transfer-requests', { preHandler: authenticate }, async (request, reply) => {
    const parsed = transferRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
    }
    const { toUserId, reason } = parsed.data;
    const { sub } = request.user;

    const task = await prisma.task.findUnique({ where: { id: request.params.id }, include: taskInclude });
    if (!task) return reply.code(404).send({ error: 'NotFound' });

    const isAssignee = task.assignees.some((a) => a.userId === sub);
    if (!isAssignee && request.user.role === 'STAFF') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only assignees can request a transfer' });
    }

    const transfer = await prisma.taskTransferRequest.create({
      data: {
        taskId: task.id,
        requestedById: sub,
        fromUserId: sub,
        toUserId,
        reason,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    });
    await logActivity(task.id, sub, 'TRANSFER_REQUESTED', sub, toUserId);

    return reply.code(201).send(transfer);
  });

  // POST /tasks/:id/transfer-requests/:transferId/review - Lead/Admin approves/rejects
  fastify.post(
    '/tasks/:id/transfer-requests/:transferId/review',
    { preHandler: [authenticate, requireRole(['LEAD', 'ADMIN'])] },
    async (request, reply) => {
      const parsed = transferReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }
      const { decision, note } = parsed.data;
      const { sub } = request.user;
      const { id: taskId, transferId } = request.params;

      const transfer = await prisma.taskTransferRequest.findUnique({ where: { id: transferId } });
      if (!transfer || transfer.taskId !== taskId) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      if (transfer.status !== 'PENDING') {
        return reply.code(400).send({ error: 'InvalidState', message: 'Transfer request already resolved' });
      }

      const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

      const updatedTransfer = await prisma.$transaction(async (tx) => {
        const t = await tx.taskTransferRequest.update({
          where: { id: transferId },
          data: { status: newStatus, reviewedById: sub, reviewNote: note ?? null, reviewedAt: new Date() },
        });

        if (decision === 'APPROVE') {
          // remove old assignee, add new one (idempotent via upsert-like behavior)
          await tx.taskAssignee.deleteMany({ where: { taskId, userId: transfer.fromUserId } });
          await tx.taskAssignee.upsert({
            where: { taskId_userId: { taskId, userId: transfer.toUserId } },
            update: {},
            create: { taskId, userId: transfer.toUserId },
          });
          await tx.taskActivity.create({
            data: {
              taskId,
              actorId: sub,
              action: 'TRANSFERRED',
              fromValue: transfer.fromUserId,
              toValue: transfer.toUserId,
            },
          });
        } else {
          await tx.taskActivity.create({
            data: { taskId, actorId: sub, action: 'TRANSFER_REJECTED', fromValue: transfer.fromUserId, toValue: transfer.toUserId },
          });
        }

        return t;
      });

      const fullTask = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
      return reply.send({ transfer: updatedTransfer, task: fullTask });
    }
  );

  // POST /tasks/:id/reassign - direct reassignment by Lead/Admin (no approval needed, e.g. for leave coverage)
  fastify.post(
    '/tasks/:id/reassign',
    { preHandler: [authenticate, requireRole(['LEAD', 'ADMIN'])] },
    async (request, reply) => {
      const schema = z.object({
        fromUserId: z.string().uuid(),
        toUserId: z.string().uuid(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      }
      const { fromUserId, toUserId } = parsed.data;
      const { sub } = request.user;
      const taskId = request.params.id;

      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) return reply.code(404).send({ error: 'NotFound' });

      await prisma.$transaction(async (tx) => {
        await tx.taskAssignee.deleteMany({ where: { taskId, userId: fromUserId } });
        await tx.taskAssignee.upsert({
          where: { taskId_userId: { taskId, userId: toUserId } },
          update: {},
          create: { taskId, userId: toUserId },
        });
        await tx.taskActivity.create({
          data: { taskId, actorId: sub, action: 'REASSIGNED_BY_LEAD', fromValue: fromUserId, toValue: toUserId },
        });
      });

      const fullTask = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
      return reply.send(fullTask);
    }
  );
}
