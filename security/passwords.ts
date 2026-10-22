import bcrypt from "bcryptjs";

const configuredCost = Number.parseInt(process.env.BCRYPT_COST || "12", 10);
const cost = Number.isFinite(configuredCost) ? Math.min(15, Math.max(12, configuredCost)) : 12;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Passwort muss 12 bis 128 Zeichen lang sein.");
  }
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || password.length > 128 || !storedHash) return false;
  try { return await bcrypt.compare(password, storedHash); } catch { return false; }
}

/** Prefer opaque, random session IDs backed by a server-side session store. Rotate after login. */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
  // Omit Domain to keep this cookie host-only.
};
