import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { publicUser } from "../../../lib/db";
import { getPlanConfig } from "../../../lib/plans";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: publicUser(user),
    plan: getPlanConfig(user.plan),
  });
}
