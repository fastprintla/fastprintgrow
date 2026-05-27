import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { newId, readDb, writeDb } from "../../../lib/db";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const db = await readDb();
  const exports = db.exportHistory
    .filter((item) => item.userId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return NextResponse.json({ exports });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    exportType?: string;
    resultCount?: number;
  };

  const db = await readDb();
  db.exportHistory.push({
    id: newId("export"),
    userId: user.id,
    exportType: body.exportType?.trim() || "csv",
    resultCount: Number.isFinite(Number(body.resultCount)) ? Math.max(0, Math.floor(Number(body.resultCount))) : 0,
    createdAt: new Date().toISOString(),
  });

  await writeDb(db);
  return NextResponse.json({ saved: true });
}
