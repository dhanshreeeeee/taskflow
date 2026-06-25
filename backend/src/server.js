import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import taskRoutes from './routes/tasks.js';
import leaveRoutes from './routes/leave.js';
import holidayRoutes from './routes/holidays.js';
import dashboardRoutes from './routes/dashboard.js';
import templateRoutes from './routes/templates.js';
import { runDueRecurringTasks } from './utils/recurrence.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me-in-production',
});

// Decorate request.user from the verified JWT payload
fastify.addHook('preHandler', async (request) => {
  if (request.headers.authorization) {
    try {
      const decoded = fastify.jwt.decode(request.headers.authorization.replace('Bearer ', ''));
      // not used for auth decisions directly — real verification happens in authenticate()
    } catch {
      /* ignore - authenticate() middleware handles real verification per-route */
    }
  }
});

// After jwtVerify() runs in authenticate(), request.user is set by @fastify/jwt automatically
// (it sets request.user = payload), so route handlers can read request.user.sub / .role / .teamId

fastify.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

await fastify.register(authRoutes);
await fastify.register(teamRoutes);
await fastify.register(taskRoutes);
await fastify.register(leaveRoutes);
await fastify.register(holidayRoutes);
await fastify.register(dashboardRoutes);
await fastify.register(templateRoutes);

// Check for due recurring task templates every 5 minutes, and once on startup
// (catches anything that was due while the server was offline).
const RECURRENCE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
async function checkRecurringTasks() {
  try {
    const created = await runDueRecurringTasks();
    if (created.length > 0) {
      fastify.log.info(`Generated ${created.length} task(s) from recurring templates`);
    }
  } catch (err) {
    fastify.log.error({ err }, 'Failed to run recurring task generator');
  }
}
checkRecurringTasks();
setInterval(checkRecurringTasks, RECURRENCE_CHECK_INTERVAL_MS);

const PORT = process.env.PORT || 4100;

fastify
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    fastify.log.info(`TaskFlow backend running on port ${PORT}`);
  })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
