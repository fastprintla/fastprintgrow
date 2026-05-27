import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    starter: process.env.STARTER_SHOPIFY_URL || "",
    growth: process.env.GROWTH_SHOPIFY_URL || "",
    pro: process.env.PRO_SHOPIFY_URL || "",
    agency: process.env.AGENCY_SHOPIFY_URL || "",
  });
}
