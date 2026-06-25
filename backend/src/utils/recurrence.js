// Recurrence engine: computes when a template should next fire, and
// materializes a real Task row (with TaskAssignee rows) when it's due.

import { prisma } from './prisma.js';

/**
 * Given a recurrence type and an anchor date, compute the next run date.
 * - DAILY: every day at the same time
 * - WEEKLY: next occurrence of `weekday` (0=Sun..6=Sat)
 * - MONTHLY: next occurrence of `dayOfMonth`
 * - QUARTERLY: every 3 months on `dayOfMonth`
 */
export function computeNextRun(recurrenceType, fromDate, { weekday, dayOfMonth } = {}) {
  const next = new Date(fromDate);

  switch (recurrenceType) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      return next;

    case 'WEEKLY': {
      const targetDay = weekday ?? next.getDay();
      next.setDate(next.getDate() + 1); // start searching from tomorrow
      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    case 'MONTHLY': {
      const targetDom = dayOfMonth ?? next.getDate();
      // Move to day 1 first to avoid month-end overflow (e.g. Mar 31 -> setMonth(+1) skips to May)
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDom, daysInMonth(next)));
      return next;
    }

    case 'QUARTERLY': {
      const targetDom = dayOfMonth ?? next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 3);
      next.setDate(Math.min(targetDom, daysInMonth(next)));
      return next;
    }

    default:
      return null; // ONE_TIME has no next run
  }
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Find all active templates whose nextRunAt has passed, and generate
 * a Task instance for each. Safe to call repeatedly (e.g. on an interval) —
 * each run only fires templates that are actually due, then reschedules them.
 */
export async function runDueRecurringTasks() {
  const now = new Date();
  const due = await prisma.recurringTaskTemplate.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
  });

  const created = [];
  for (const template of due) {
    const task = await prisma.task.create({
      data: {
        title: template.title,
        description: template.description,
        priority: template.priority,
        recurrenceType: template.recurrenceType,
        createdById: template.createdById,
        teamId: template.teamId,
        templateId: template.id,
        assignees: {
          create: (template.assigneeIds || []).map((userId) => ({ userId })),
        },
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: template.createdById,
        action: 'CREATED',
        toValue: `Auto-generated from recurring template (${template.recurrenceType})`,
      },
    });

    const nextRunAt = computeNextRun(template.recurrenceType, now, {
      weekday: template.weekday,
      dayOfMonth: template.dayOfMonth,
    });

    await prisma.recurringTaskTemplate.update({
      where: { id: template.id },
      data: { lastRunAt: now, nextRunAt },
    });

    created.push(task);
  }

  return created;
}
