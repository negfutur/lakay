import { acquireAiRequestLeaseForUser, releaseAiRequestLeaseForUser } from "./db";

const activeRequests = new Map<number, string>();

/**
 * Process-local mutex for short-lived Builder request handlers. Durable build work is
 * additionally protected by the persisted background-task check in the Builder router.
 */
export async function acquireUserAiRequestLock(userId: number, requestId: string) {
  if (activeRequests.has(userId)) return null;
  if (!await acquireAiRequestLeaseForUser(userId, requestId)) return null;
  activeRequests.set(userId, requestId);
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    if (activeRequests.get(userId) === requestId) activeRequests.delete(userId);
    await releaseAiRequestLeaseForUser(userId, requestId);
  };
}

export function resetUserAiRequestLocksForTests() {
  activeRequests.clear();
}
