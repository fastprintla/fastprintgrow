import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { newId, readDb, writeDb } from "../../../lib/db";
import { getPlanConfig } from "../../../lib/plans";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const db = await readDb();
  return NextResponse.json({
    savedLeads: db.savedLeads
      .filter((lead) => lead.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const plan = getPlanConfig(user.plan);

  if (!plan.allowSavedLeads) {
    return NextResponse.json({ error: "Saved leads are not available for this plan." }, { status: 403 });
  }

  const body = (await request.json()) as {
    lead?: {
      id: string;
      name: string;
      address: string;
      phone: string;
      website: string;
      mapsLink: string;
      rating: string;
      category: string;
      primaryEmail?: string;
      allEmails?: string[];
    };
  };

  if (!body.lead?.id) {
    return NextResponse.json({ error: "Lead is required." }, { status: 400 });
  }

  const db = await readDb();
  const existing = db.savedLeads.find((lead) => lead.userId === user.id && lead.leadId === body.lead?.id);

  if (existing) {
    db.savedLeads = db.savedLeads.filter((lead) => lead.id !== existing.id);
    await writeDb(db);
    return NextResponse.json({ saved: false });
  }

  const currentSavedCount = db.savedLeads.filter((lead) => lead.userId === user.id).length;
  if (typeof plan.savedLeadLimit === "number" && currentSavedCount >= plan.savedLeadLimit) {
    return NextResponse.json({ error: `Your plan allows ${plan.savedLeadLimit} saved leads.` }, { status: 403 });
  }

  db.savedLeads.push({
    id: newId("saved"),
    userId: user.id,
    userEmail: user.email,
    leadId: body.lead.id,
    name: body.lead.name,
    address: body.lead.address,
    phone: body.lead.phone,
    website: body.lead.website,
    mapsLink: body.lead.mapsLink,
    rating: body.lead.rating,
    category: body.lead.category,
    primaryEmail: body.lead.primaryEmail,
    allEmails: body.lead.allEmails,
    createdAt: new Date().toISOString(),
  });

  await writeDb(db);
  return NextResponse.json({ saved: true });
}
