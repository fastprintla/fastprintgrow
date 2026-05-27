import { NextRequest, NextResponse } from "next/server";
import {
  createAdminCookieValue,
  getAdminCookieName,
  getAdminMaxLeads,
  isAdminPasswordValid,
  isAdminRequest,
} from "../../admin-auth";
import { isAdminAccess } from "../../../lib/admin-access";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: await isAdminAccess(request),
    maxLeads: getAdminMaxLeads(),
  });
}

export async function POST(request: NextRequest) {
  const { password } = (await request.json()) as { password?: string };

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured in .env." },
      { status: 500 },
    );
  }

  if (!isAdminPasswordValid(password || "")) {
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  const response = NextResponse.json({
    authenticated: true,
    maxLeads: getAdminMaxLeads(),
  });

  response.cookies.set({
    name: getAdminCookieName(),
    value: createAdminCookieValue(),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
