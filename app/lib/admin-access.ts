import type { NextRequest } from "next/server";
import { isAdminRequest } from "../api/admin-auth";
import { getSessionUser } from "./auth";

export async function isAdminAccess(request: NextRequest) {
  if (isAdminRequest(request)) {
    return true;
  }

  const user = await getSessionUser(request);
  return user?.plan === "admin";
}
