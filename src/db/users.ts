import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string, role?: string) {
  try {
    const displayName = name || email.split('@')[0] || 'Responder';
    const userRole = role || 'citizen';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: displayName,
        role: userRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}
