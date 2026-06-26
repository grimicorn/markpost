import { getOrCreateTestClerkUser } from "./helpers/clerk";

export default async function globalSetup() {
  console.log("[e2e setup] Ensuring Clerk test user exists...");
  await getOrCreateTestClerkUser();
  console.log("[e2e setup] Done.");
}
