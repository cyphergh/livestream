import type { User } from '@prisma/client';

export const isAdmin = (u?: User | { role: string }) => u?.role === 'ADMIN';
export const isProducer = (u?: User | { role: string }) => u?.role === 'ADMIN' || u?.role === 'PRODUCER';