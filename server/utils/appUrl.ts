const APP_URL_ENV = "NUXT_PUBLIC_APP_URL";

export function buildAppUrl(): string {
  const appUrl = process.env[APP_URL_ENV];
  if (!appUrl) {
    throw new Error(`${APP_URL_ENV} is not set`);
  }

  return appUrl.replace(/\/$/, "");
}
