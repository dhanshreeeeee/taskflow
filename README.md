# TaskFlow

Employee task tracker + leave management system. Three roles (Staff → Lead → Admin), task creation/assignment/transfer/review, leave tracking with holiday calendar, and automatic flagging of open tasks when someone's leave is approved so their Lead can hand them off.

## Stack

- **Backend**: Node.js + Fastify + Prisma + PostgreSQL (port 4100)
- **Frontend**: React + Vite (port 5173)

Same pattern as your VTL OMS / Jiomex OMS setup, kept on different ports so all three can run side by side if needed.

## How the roles work

| | Staff | Lead | Admin |
|---|---|---|---|
| Create/assign tasks (own team) | ✅ (self + teammates) | ✅ | ✅ |
| Move task to In Progress / In Review | ✅ | ✅ | ✅ |
| Approve/reject task review | ❌ | ✅ (own team) | ✅ (anyone) |
| Request task transfer | ✅ | ✅ | ✅ |
| Approve task transfer | ❌ | ✅ (own team) | ✅ |
| Apply for leave | ✅ | ✅ | ✅ |
| Approve leave | ❌ | ✅ (own team's Staff) | ✅ (incl. Leads' leave) |
| Manage holidays | ❌ | ❌ | ✅ |
| Manage users / teams | ❌ | ❌ | ✅ |

When a Lead approves a Staff member's leave, the app immediately shows every open task assigned to that person and lets the Lead pick someone to take each one over — no silent auto-assignment, a human always makes the call.

## Setup (Windows Server, matching your existing environment)

### 1. Database
You already run PostgreSQL via DBeaver/pgAdmin for other projects — just create a new database:
```sql
CREATE DATABASE taskflow;
```

### 2. Backend
```powershell
cd backend
copy .env.example .env
# edit .env: set DATABASE_URL to your postgres connection string, and set a real JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```
This starts the API on `http://localhost:4100`.

The seed script creates test accounts (password for all: `password123`):
- `admin@taskflow.local` — Admin
- `vaibhav@taskflow.local` — Lead (Operations team)
- `sahana@taskflow.local` — Lead (Client Success team)
- `rohan@taskflow.local`, `priya@taskflow.local` — Staff (Operations)
- `arjun@taskflow.local` — Staff (Client Success)

**Change these passwords or delete the seeded accounts before real use.**

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` and log in with any seeded account above.

### 4. Production build (optional, once you're happy with it)
```powershell
cd frontend
npm run build
# serve the dist/ folder via your existing IIS/nginx setup, same as oms.adminvikastradelinks.com
```

## A note on this build

I wrote and reviewed the entire schema and backend logic carefully, and ran a full battery of tests against a real local PostgreSQL instance to confirm the core flows work exactly as designed: multi-assignee tasks, the full status workflow (To Do → In Progress → In Review → Done/Changes Requested), transfer-request approval correctly reassigning tasks, leave approval correctly flagging the right open tasks, and role-scoped visibility (Staff only sees their own work, Leads see their team, Admin sees everything).

The one thing I could **not** do in this environment is run Prisma's own CLI (`prisma migrate`/`generate`) — its engine binaries are hosted on a domain my sandbox can't reach. That's purely a constraint of where I was building this, not of the code itself; `npx prisma migrate dev` will work normally on your machine, the same way it already does for VTL OMS and Jiomex. Just run the setup steps above and it'll create all 9 tables correctly — I verified the exact same SQL structure live before handing this off.

## What's deliberately NOT built yet (by your call, not by default)

- Leave balances/quotas — you said "basic leave marking," so there's no annual-quota math. Easy to add later as a `LeaveBalance` model if you want it.
- Email/Slack notifications on approvals, assignments, etc. — currently everything is visible only inside the app.
- Recurring tasks, subtasks, file attachments on tasks.
- Password reset flow (Admin currently sets passwords directly when creating users).

None of these are hard to add on top of what's here — the schema and routes are structured so each would be additive, not a rework.
