import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "fastlead_admin";
const TOKEN_PAYLOAD = "fastlead-admin";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

function signAdminToken() {
  const password = getAdminPassword();

  if (!password) {
    return "";
  }

  const signature = createHmac("sha256", password).update(TOKEN_PAYLOAD).digest("hex");
  return `${TOKEN_PAYLOAD}.${signature}`;
}

export function createAdminCookieValue() {
  return signAdminToken();
}

export function getAdminCookieName() {
  return ADMIN_COOKIE;
}

export function isAdminRequest(request: NextRequest) {
  const expected = signAdminToken();
  const received = request.cookies.get(ADMIN_COOKIE)?.value || "";

  if (!expected || !received) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function getAdminMaxLeads() {
  const configuredMax = Number(process.env.ADMIN_MAX_LEADS);

  if (!Number.isFinite(configuredMax) || configuredMax < 1) {
    return 1000;
  }

  return Math.min(Math.floor(configuredMax), 1000);
}

export function isAdminPasswordValid(password: string) {
  const expected = getAdminPassword();

  if (!expected || !password) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const passwordBuffer = Buffer.from(password);

  return (
    expectedBuffer.length === passwordBuffer.length &&
    timingSafeEqual(expectedBuffer, passwordBuffer)
  );
}
