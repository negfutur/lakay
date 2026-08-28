import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ acquireAiRequestLeaseForUser: vi.fn(), releaseAiRequestLeaseForUser: vi.fn() }));

import { acquireUserAiRequestLock, resetUserAiRequestLocksForTests } from "./aiRequestLock";
import { acquireAiRequestLeaseForUser, releaseAiRequestLeaseForUser } from "./db";

describe("per-user Lakay AI request lock", () => {
  beforeEach(() => vi.mocked(acquireAiRequestLeaseForUser).mockResolvedValue(true));
  afterEach(() => resetUserAiRequestLocksForTests());

  it("rejects a concurrent request for the same user and releases only the matching request", async () => {
    const releaseFirst = await acquireUserAiRequestLock(7, "first-request");
    expect(releaseFirst).toEqual(expect.any(Function));
    await expect(acquireUserAiRequestLock(7, "second-request")).resolves.toBeNull();
    await expect(acquireUserAiRequestLock(8, "other-user-request")).resolves.toEqual(expect.any(Function));

    await releaseFirst?.();
    expect(releaseAiRequestLeaseForUser).toHaveBeenCalledWith(7, "first-request");
    await expect(acquireUserAiRequestLock(7, "second-request")).resolves.toEqual(expect.any(Function));
  });

  it("rejects a lease owned by another active process", async () => {
    vi.mocked(acquireAiRequestLeaseForUser).mockResolvedValue(false);
    await expect(acquireUserAiRequestLock(7, "other-instance-request")).resolves.toBeNull();
  });
});
