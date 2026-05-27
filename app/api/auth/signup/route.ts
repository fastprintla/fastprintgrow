import { NextRequest, NextResponse } from "next/server";
import { createUserSessionToken, getUserCookieName, hashPassword } from "../../../lib/auth";
import { newId, publicUser, readDb, writeDb, type DbUser } from "../../../lib/db";
import { getPlanConfig, normalizePlan } from "../../../lib/plans";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      companyName?: string;
      phoneNumber?: string;
      email?: string;
      password?: string;
      industry?: string;
      notes?: string;
      adminPassword?: string;
    };

    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";

    if (!body.fullName || !body.companyName || !body.phoneNumber || !email || !body.industry) {
      return NextResponse.json({ error: "All required fields must be completed." }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const db = await readDb();

    if (db.users.some((user) => user.email === email)) {
      return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
    }

    const canCreateAdmin =
      body.adminPassword &&
      process.env.ADMIN_PASSWORD &&
      body.adminPassword === process.env.ADMIN_PASSWORD;

    const plan = normalizePlan(canCreateAdmin ? "admin" : "free");
    const planConfig = getPlanConfig(plan);
    const user: DbUser = {
      id: newId("user"),
      fullName: body.fullName.trim(),
      companyName: body.companyName.trim(),
      phoneNumber: body.phoneNumber.trim(),
      email,
      passwordHash: password ? hashPassword(password) : "",
      industry: body.industry.trim(),
      notes: body.notes?.trim() || "",
      plan,
      creditsRemaining: planConfig.creditTotal,
      creditsTotal: planConfig.creditTotal,
      chargedLeadIds: [],
      shopifyOrderNumber: "",
      paymentStatus: plan === "free" ? "pending" : "paid",
      active: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      totalSearches: 0,
    };

    db.users.push(user);
    await writeDb(db);

    const response = NextResponse.json({ user: publicUser(user) });
    response.cookies.set({
      name: getUserCookieName(),
      value: createUserSessionToken(user.id),
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
