import { NextRequest, NextResponse } from "next/server";
import { createMagicToken, hashMagicToken } from "../../../lib/auth";
import { newId, readDb, writeDb } from "../../../lib/db";

function getBaseUrl(request: NextRequest) {
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase() || "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const token = createMagicToken();
  const db = await readDb();
  const user = db.users.find((candidate) => candidate.email === email);

  if (!user) {
    return NextResponse.json(
      { error: "No account found for this email. Please create an account first.", signupUrl: `/signup?email=${encodeURIComponent(email)}` },
      { status: 404 },
    );
  }

  if (!user.active) {
    return NextResponse.json({ error: "This account has been deactivated." }, { status: 403 });
  }

  db.magicLinks.push({
    id: newId("magic"),
    email,
    tokenHash: hashMagicToken(token),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  });

  await writeDb(db);

  const magicLink = `${getBaseUrl(request)}/api/auth/magic?token=${token}`;

  if (process.env.NODE_ENV !== "production" || !process.env.SMTP_HOST) {
    console.log(`[fastprintgrow] Magic login link for ${email}: ${magicLink}`);
  }

  return NextResponse.json({
    sent: true,
    magicLink:
      process.env.NODE_ENV !== "production" || !process.env.SMTP_HOST
        ? magicLink
        : undefined,
    message:
      process.env.NODE_ENV !== "production" || !process.env.SMTP_HOST
        ? "Magic link created. Use the local development login button below."
        : "Check your email for a magic login link.",
  });
}
