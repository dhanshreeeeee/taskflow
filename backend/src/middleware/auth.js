// Auth & role-based access control middleware for Fastify

export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
  }
}

/**
 * requireRole(['LEAD', 'ADMIN']) - allows only listed roles through
 */
export function requireRole(allowedRoles) {
  return async function (request, reply) {
    const userRole = request.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
      });
    }
  };
}

export const ROLE_RANK = { STAFF: 1, LEAD: 2, ADMIN: 3 };

export function isAtLeast(role, minRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
