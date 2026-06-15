import type { H3Event } from "h3";
import { unauthorized } from "./errors";

export function requireUser(event: H3Event): string {
  const userId = event.context.userId as string | undefined;
  if (!userId) {
    throw unauthorized();
  }
  return userId;
}
