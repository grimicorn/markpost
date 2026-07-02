import { createClerkClient } from "@clerk/backend";

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

export function getClerkClient() {
  if (cachedClerkClient) {
    return cachedClerkClient;
  }

  const secretKey = process.env.NUXT_CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("NUXT_CLERK_SECRET_KEY is not set");
  }

  cachedClerkClient = createClerkClient({ secretKey });
  return cachedClerkClient;
}

export async function deleteClerkUser(userId: string): Promise<void> {
  await getClerkClient().users.deleteUser(userId);
}
