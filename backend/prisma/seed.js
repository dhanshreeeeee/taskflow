import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding TaskFlow database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // --- Admin ---
  const admin = await prisma.user.create({
    data: { name: 'Dhanshree (Admin)', email: 'admin@taskflow.local', passwordHash, role: 'ADMIN' },
  });

  // --- Team 1: Operations ---
  const opsLead = await prisma.user.create({
    data: { name: 'Vaibhav (Lead)', email: 'vaibhav@taskflow.local', passwordHash, role: 'LEAD' },
  });
  const opsTeam = await prisma.team.create({
    data: { name: 'Operations', leadId: opsLead.id },
  });
  await prisma.user.update({ where: { id: opsLead.id }, data: { teamId: opsTeam.id } });

  const opsStaff1 = await prisma.user.create({
    data: { name: 'Rohan (Staff)', email: 'rohan@taskflow.local', passwordHash, role: 'STAFF', teamId: opsTeam.id },
  });
  const opsStaff2 = await prisma.user.create({
    data: { name: 'Priya (Staff)', email: 'priya@taskflow.local', passwordHash, role: 'STAFF', teamId: opsTeam.id },
  });

  // --- Team 2: Client Success ---
  const csLead = await prisma.user.create({
    data: { name: 'Sahana (Lead)', email: 'sahana@taskflow.local', passwordHash, role: 'LEAD' },
  });
  const csTeam = await prisma.team.create({
    data: { name: 'Client Success', leadId: csLead.id },
  });
  await prisma.user.update({ where: { id: csLead.id }, data: { teamId: csTeam.id } });

  const csStaff1 = await prisma.user.create({
    data: { name: 'Arjun (Staff)', email: 'arjun@taskflow.local', passwordHash, role: 'STAFF', teamId: csTeam.id },
  });

  // --- Sample tasks ---
  const task1 = await prisma.task.create({
    data: {
      title: 'Investigate DC auto-allocation failure - Coach Japan',
      description: 'Diagnose why DC auto-allocation codes are not finalizing for select SKUs.',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      createdById: opsLead.id,
      teamId: opsTeam.id,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      assignees: { create: [{ userId: opsStaff1.id }] },
    },
  });
  await prisma.taskActivity.create({
    data: { taskId: task1.id, actorId: opsLead.id, action: 'CREATED', toValue: task1.title },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Fix article misclassification in allocation dashboard',
      description: 'Channel format mismatch in final_tag CTE causing wrong article tags.',
      priority: 'HIGH',
      status: 'IN_REVIEW',
      createdById: opsStaff2.id,
      teamId: opsTeam.id,
      assignees: { create: [{ userId: opsStaff2.id }] },
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: 'Prepare weekly client status update - Kate Spade',
      priority: 'MEDIUM',
      status: 'TODO',
      createdById: csLead.id,
      teamId: csTeam.id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      assignees: { create: [{ userId: csStaff1.id }] },
    },
  });

  // --- Sample leave request ---
  await prisma.leaveRequest.create({
    data: {
      userId: opsStaff1.id,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      reason: 'Family function',
      status: 'PENDING',
    },
  });

  // --- Sample recurring template (weekly status report, every Monday) ---
  const today = new Date();
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
  await prisma.recurringTaskTemplate.create({
    data: {
      title: 'Weekly client status update',
      description: 'Send the weekly status summary to all active clients.',
      priority: 'MEDIUM',
      recurrenceType: 'WEEKLY',
      weekday: 1, // Monday
      nextRunAt: nextMonday,
      assigneeIds: [csStaff1.id],
      teamId: csTeam.id,
      createdById: csLead.id,
    },
  });

  // --- Company holidays (India, sample) ---
  const holidays = [
    { date: new Date('2026-01-26'), name: 'Republic Day' },
    { date: new Date('2026-03-04'), name: 'Holi' },
    { date: new Date('2026-08-15'), name: 'Independence Day' },
    { date: new Date('2026-10-02'), name: 'Gandhi Jayanti' },
    { date: new Date('2026-11-08'), name: 'Diwali' },
    { date: new Date('2026-12-25'), name: 'Christmas' },
  ];
  for (const h of holidays) {
    await prisma.holiday.create({ data: h });
  }

  console.log('\nSeed complete. Login credentials (all passwords: password123):');
  console.log('  Admin:        admin@taskflow.local');
  console.log('  Lead (Ops):   vaibhav@taskflow.local');
  console.log('  Lead (CS):    sahana@taskflow.local');
  console.log('  Staff (Ops):  rohan@taskflow.local / priya@taskflow.local');
  console.log('  Staff (CS):   arjun@taskflow.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
