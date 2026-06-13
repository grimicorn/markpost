import { createClerkClient } from "@clerk/backend";

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) return;

  const clerkClient = createClerkClient({
    secretKey: process.env.NUXT_CLERK_SECRET_KEY,
  });

  const token = getHeader(event, "authorization")?.replace("Bearer ", "");
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  try {
    const { sub } = await clerkClient.verifyToken(token);
    event.context.userId = sub;
  } catch {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
});
