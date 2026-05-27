import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { readDb } from "../../../lib/db";
import { getPlanConfig } from "../../../lib/plans";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const db = await readDb();
  const plan = getPlanConfig(user.plan);
  let history = db.searchHistory
    .filter((item) => item.userId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (plan.historyDays === 0) {
    history = [];
  } else if (typeof plan.historyDays === "number") {
    const oldestAllowed = Date.now() - plan.historyDays * 24 * 60 * 60 * 1000;
    history = history.filter((item) => Date.parse(item.createdAt) >= oldestAllowed);
  }

  return NextResponse.json({ history });
}
