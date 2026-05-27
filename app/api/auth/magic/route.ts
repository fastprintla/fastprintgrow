import { NextRequest, NextResponse } from "next/server";
import { createUserSessionToken, getUserCookieName, hashMagicToken } from "../../../lib/auth";
import { newId, publicUser, readDb, writeDb } from "../../../lib/db";
import { getPlanConfig, normalizePlan } from "../../../lib/plans";

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
    const plan = normalizePlan("free");
    const planConfig = getPlanConfig(plan);
    user = {
      id: newId("user"),
      fullName: "",
      companyName: "",
      phoneNumber: "",
      email: magicLink.email,
      passwordHash: "",
      industry: "",
      notes: "",
      plan,
      creditsRemaining: planConfig.creditTotal,
      creditsTotal: planConfig.creditTotal,
      chargedLeadIds: [],
      shopifyOrderNumber: "",
      paymentStatus: "pending",
      active: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      totalSearches: 0,
    };
    db.users.push(user);
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
