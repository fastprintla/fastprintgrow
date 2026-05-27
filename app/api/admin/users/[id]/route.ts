import { NextRequest, NextResponse } from "next/server";
import { isAdminAccess } from "../../../../lib/admin-access";
import { publicUser, readDb, writeDb, type PaymentStatus } from "../../../../lib/db";
import { getPlanConfig, normalizePlan } from "../../../../lib/plans";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAccess(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    plan?: string;
    creditsRemaining?: number | null;
    shopifyOrderNumber?: string;
    paymentStatus?: PaymentStatus;
    active?: boolean;
    resetCredits?: boolean;
  };
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === id);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (typeof body.plan === "string") {
    user.plan = normalizePlan(body.plan);
    const planConfig = getPlanConfig(user.plan);
    user.creditsTotal = planConfig.creditTotal;
    if (body.resetCredits || user.creditsRemaining === null || user.creditsRemaining > (planConfig.creditTotal ?? Number.MAX_SAFE_INTEGER)) {
      user.creditsRemaining = planConfig.creditTotal;
    }
  }

  if (typeof body.creditsRemaining === "number") {
    user.creditsRemaining = Math.max(0, Math.floor(body.creditsRemaining));
  }

  if (body.resetCredits) {
    user.creditsRemaining = getPlanConfig(user.plan).creditTotal;
    user.chargedLeadIds = [];
  }

  if (typeof body.shopifyOrderNumber === "string") {
    user.shopifyOrderNumber = body.shopifyOrderNumber.trim();
  }

  if (body.paymentStatus && ["pending", "paid", "expired", "refunded"].includes(body.paymentStatus)) {
    user.paymentStatus = body.paymentStatus;
  }

  if (typeof body.active === "boolean") {
    user.active = body.active;
  }

  await writeDb(db);

  return NextResponse.json({ user: publicUser(user) });
}
