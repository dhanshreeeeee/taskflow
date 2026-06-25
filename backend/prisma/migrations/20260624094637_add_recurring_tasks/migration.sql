-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "RecurringTaskTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "recurrenceType" "RecurrenceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "teamId" TEXT,
    "assigneeIds" TEXT[],
    "weekday" INTEGER,
    "dayOfMonth" INTEGER,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringTaskTemplate_nextRunAt_idx" ON "RecurringTaskTemplate"("nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringTaskTemplate_isActive_idx" ON "RecurringTaskTemplate"("isActive");

-- CreateIndex
CREATE INDEX "Task_recurrenceType_idx" ON "Task"("recurrenceType");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringTaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTaskTemplate" ADD CONSTRAINT "RecurringTaskTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTaskTemplate" ADD CONSTRAINT "RecurringTaskTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
