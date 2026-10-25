export type Environment = Record<string, string | undefined>;

/** Report field names only: never include credential contents in diagnostics. */
export function validateEnvironment(env: Environment, production = env.NODE_ENV === "production"): string[] {
  const errors: string[] = [];
  const required = (key: string) => { if (!env[key]?.trim()) errors.push(`${key}: wajib diisi`); };
  required("DATABASE_URL");
  required("ADMIN_SESSION_SECRET");
  if (env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length < 32) errors.push("ADMIN_SESSION_SECRET: minimal 32 karakter");
  const appUrl = env.APP_URL || env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) errors.push("APP_URL atau NEXT_PUBLIC_APP_URL: wajib diisi");
  else {
    try {
      const url = new URL(appUrl);
      if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
        (production && url.protocol !== "https:")) errors.push("APP_URL/NEXT_PUBLIC_APP_URL: gunakan origin HTTP(S) tanpa path/kredensial, HTTPS di production");
    } catch { errors.push("APP_URL/NEXT_PUBLIC_APP_URL: URL tidak valid"); }
  }
  if (env.APP_URL && env.NEXT_PUBLIC_APP_URL && env.APP_URL !== env.NEXT_PUBLIC_APP_URL) errors.push("APP_URL dan NEXT_PUBLIC_APP_URL: harus sama");
  if (env.ALLOWED_ORIGINS) for (const origin of env.ALLOWED_ORIGINS.split(",")) {
    try { const url = new URL(origin.trim()); if (url.origin !== origin.trim() || !["https:", "http:"].includes(url.protocol) || (production && url.protocol !== "https:")) throw Error(); }
    catch { errors.push("ALLOWED_ORIGINS: harus daftar origin HTTP(S) valid, HTTPS di production"); break; }
  }
  if (env.MIDTRANS_IS_PRODUCTION && !["true", "false"].includes(env.MIDTRANS_IS_PRODUCTION)) errors.push("MIDTRANS_IS_PRODUCTION: gunakan true atau false");
  if (env.MIDTRANS_IS_PRODUCTION === "true" && !production) errors.push("MIDTRANS_IS_PRODUCTION: mode live hanya di NODE_ENV=production");
  const midtrans = ["MIDTRANS_SERVER_KEY", "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY"];
  if (production || midtrans.some(key => env[key])) midtrans.forEach(required);
  const vapid = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
  if (vapid.some(key => env[key])) {
    vapid.forEach(required);
    if (env.VAPID_SUBJECT && !/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VAPID_SUBJECT)) errors.push("VAPID_SUBJECT: gunakan mailto:alamat-valid");
  }
  return errors;
}
