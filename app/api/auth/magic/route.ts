import { NextRequest, NextResponse } from "next/server";
import { createUserSessionToken, getUserCookieName, hashMagicToken } from "../../../lib/auth";
import { publicUser, readDb, writeDb } from "../../../lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const tokenHash = hashMagicToken(token);
  const db = await readDb();
  const magicLink = db.magicLinks.find((link) => link.tokenHash === tokenHash);

  if (!magicLink || magicLink.usedAt || Date.parse(magicLink.expiresAt) < Date.now()) {
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  let user = db.users.find((candidate) => candidate.email === magicLink.email);

  if (!user) {
    return NextResponse.redirect(new URL(`/signup?email=${encodeURIComponent(magicLink.email)}`, request.url));
  }

  if (!user.active) {
    return NextResponse.redirect(new URL("/login?error=deactivated", request.url));
  }

  user.lastLoginAt = new Date().toISOString();
  magicLink.usedAt = new Date().toISOString();
  await writeDb(db);

  const destination = user.plan === "admin" ? "/admin" : "/dashboard";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set({
    name: getUserCookieName(),
    value: createUserSessionToken(user.id),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  response.headers.set("x-fastlead-user", JSON.stringify(publicUser(user)));

  return response;
}
