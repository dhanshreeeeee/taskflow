import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify) {
  fastify.get('/dashboard/summary', { preHandler: authenticate }, async (request, reply) => {
    const { sub, role, teamId } = request.user;

    if (role === 'STAFF') {
      const [myTasks, pendingTransfers, myLeave] = await Promise.all([
        prisma.task.findMany({
          where: { assignees: { some: { userId: sub } } },
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
        }),
        prisma.taskTransferRequest.count({ where: { fromUserId: sub, status: 'PENDING' } }),
        prisma.leaveRequest.findMany({ where: { userId: sub }, orderBy: { createdAt: 'desc' }, take: 5 }),
      ]);
      const byStatus = myTasks.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});
      return reply.send({ role, taskCountsByStatus: byStatus, totalTasks: myTasks.length, pendingTransfersOut: pendingTransfers, recentLeave: myLeave });
    }

    if (role === 'LEAD') {
      const [teamTasks, pendingReviews, pendingLeave, pendingTransfers, teamSize] = await Promise.all([
        prisma.task.findMany({ where: { teamId }, select: { id: true, status: true, priority: true } }),
        prisma.task.count({ where: { teamId, status: 'IN_REVIEW' } }),
        prisma.leaveRequest.count({ where: { status: 'PENDING', user: { teamId } } }),
        prisma.taskTransferRequest.count({ where: { status: 'PENDING', task: { teamId } } }),
        prisma.user.count({ where: { teamId, isActive: true } }),
      ]);
      const byStatus = teamTasks.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});
      return reply.send({
        role,
        teamSize,
        taskCountsByStatus: byStatus,
        totalTasks: teamTasks.length,
        pendingReviews,
        pendingLeaveApprovals: pendingLeave,
        pendingTransferApprovals: pendingTransfers,
      });
    }

    // ADMIN
    const [allTasks, pendingReviews, pendingLeave, pendingTransfers, teamCount, userCount] = await Promise.all([
      prisma.task.findMany({ select: { id: true, status: true } }),
      prisma.task.count({ where: { status: 'IN_REVIEW' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.taskTransferRequest.count({ where: { status: 'PENDING' } }),
      prisma.team.count(),
      prisma.user.count({ where: { isActive: true } }),
    ]);
    const byStatus = allTasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    return reply.send({
      role,
      taskCountsByStatus: byStatus,
      totalTasks: allTasks.length,
      pendingReviews,
      pendingLeaveApprovals: pendingLeave,
      pendingTransferApprovals: pendingTransfers,
      teamCount,
      userCount,
    });
  });
}
