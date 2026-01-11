import { NextResponse } from "next/server";

import { syncGmailApplications } from "@/lib/gmail";

export const runtime = "nodejs";

export const POST = async () => {
  try {
    const result = await syncGmailApplications();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
