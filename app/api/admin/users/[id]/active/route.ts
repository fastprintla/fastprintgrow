import { NextRequest, NextResponse } from "next/server";
import { isAdminAccess } from "../../../../../lib/admin-access";
import { publicUser, readDb, writeDb } from "../../../../../lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAccess(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { active?: boolean };
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.id === id);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  user.active = Boolean(body.active);
  await writeDb(db);

  return NextResponse.json({ user: publicUser(user) });
}
