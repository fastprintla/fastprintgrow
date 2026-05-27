import { createHmac, createHash, randomBytes, timingSafeEqual, scryptSync } from "crypto";
import type { NextRequest } from "next/server";
import { readDb } from "./db";

const USER_COOKIE = "fastlead_user";

function getAuthSecret() {
  return process.env.MAGIC_LINK_SECRET || process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "fastlead-local-dev-secret";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");

  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

export function getUserCookieName() {
  return USER_COOKIE;
}

export function createUserSessionToken(userId: string) {
  const signature = createHmac("sha256", getAuthSecret()).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

export function createMagicToken() {
  return randomBytes(32).toString("hex");
}

export function hashMagicToken(token: string) {
  return createHash("sha256").update(`${getAuthSecret()}:${token}`).digest("hex");
}

export function getUserIdFromRequest(request: NextRequest) {
  const token = request.cookies.get(USER_COOKIE)?.value || "";
  const [userId, signature] = token.split(".");

  if (!userId || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getAuthSecret()).update(userId).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null;
  }

  return userId;
}

export async function getSessionUser(request: NextRequest) {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return null;
  }

  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === userId);

  if (!user || !user.active) {
    return null;
  }

  return user;
}
