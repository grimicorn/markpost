import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteUser = vi.fn();
const createClerkClient = vi.fn(() => ({ users: { deleteUser } }));

vi.mock("@clerk/backend", () => ({ createClerkClient }));

async function importClerk() {
  return import("../../../server/utils/clerk");
}

beforeEach(() => {
  vi.resetModules();
  deleteUser.mockReset();
  createClerkClient.mockClear();
  createClerkClient.mockReturnValue({ users: { deleteUser } });
  process.env.NUXT_CLERK_SECRET_KEY = "sk_test_123";
});

afterEach(() => {
  delete process.env.NUXT_CLERK_SECRET_KEY;
});

describe("getClerkClient", () => {
  it("throws when NUXT_CLERK_SECRET_KEY is not set", async () => {
    delete process.env.NUXT_CLERK_SECRET_KEY;
    const { getClerkClient } = await importClerk();
    expect(() => getClerkClient()).toThrow("NUXT_CLERK_SECRET_KEY is not set");
  });

  it("builds the client with the configured secret key", async () => {
    const { getClerkClient } = await importClerk();
    getClerkClient();
    expect(createClerkClient).toHaveBeenCalledWith({
      secretKey: "sk_test_123",
    });
  });

  it("caches the client across calls", async () => {
    const { getClerkClient } = await importClerk();
    getClerkClient();
    getClerkClient();
    expect(createClerkClient).toHaveBeenCalledTimes(1);
  });
});

describe("deleteClerkUser", () => {
  it("deletes the Clerk user by id", async () => {
    const { deleteClerkUser } = await importClerk();
    await deleteClerkUser("user_abc123");
    expect(deleteUser).toHaveBeenCalledWith("user_abc123");
  });
});
