import { NextResponse } from "next/server";
import { getUserCookieName } from "../../../lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getUserCookieName(),
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
