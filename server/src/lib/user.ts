import { prisma } from './db';

// Shared logic to resolve the current user from the Authorization header.
export async function resolveUser(ctx: {
  headers: Record<string, string | undefined>;
  accessJwt: { verify(token: string): Promise<any> };
}) {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  if (!token) return undefined;
  const payload = await ctx.accessJwt.verify(token);
  if (!payload || payload.type !== 'access') return undefined;
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  return user ?? undefined;
}