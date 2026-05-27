import { NextRequest, NextResponse } from "next/server";
import { isAdminAccess } from "../../../lib/admin-access";
import { publicUser, readDb } from "../../../lib/db";
import { getPlanConfig } from "../../../lib/plans";

export async function GET(request: NextRequest) {
  if (!(await isAdminAccess(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const db = await readDb();
  const today = new Date().toDateString();
  const creditsUsedToday = db.searchHistory
    .filter((item) => new Date(item.createdAt).toDateString() === today)
    .reduce((total, item) => total + (item.creditsUsed || 0), 0);
  const users = db.users.map((user) => ({
    ...publicUser(user),
    planConfig: getPlanConfig(user.plan),
    totalSearches: user.totalSearches,
    totalExports: db.exportHistory.filter((item) => item.userId === user.id).length,
    recentSearches: db.searchHistory
      .filter((item) => item.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 5),
    recentExports: db.exportHistory
      .filter((item) => item.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 5),
  }));

  const stats = {
    totalUsers: db.users.length,
    freeUsers: db.users.filter((user) => user.plan === "free").length,
    paidUsers: db.users.filter((user) => ["starter", "growth", "pro", "agency"].includes(user.plan)).length,
    activeUsers: db.users.filter((user) => user.active).length,
    totalSearches: db.searchHistory.length,
    creditsUsedToday,
    newUsersToday: db.users.filter((user) => new Date(user.createdAt).toDateString() === today).length,
  };

  return NextResponse.json({ users, stats });
}
