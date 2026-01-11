import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { applications } from "@/db/schema";

const allowedStatuses = new Set(["applied", "accepted", "rejected"]);

export const runtime = "nodejs";

export const PATCH = async (
  request: Request,
  context: { params: { id: string } }
) => {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(context.params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { status?: string }
    | null;

  const status = body?.status;
  if (!status || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await db
    .update(applications)
    .set({ status })
    .where(eq(applications.id, id));

  return NextResponse.json({ ok: true });
};

export const DELETE = async (
  _request: Request,
  context: { params: { id: string } }
) => {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(context.params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await db.delete(applications).where(eq(applications.id, id));

  return NextResponse.json({ ok: true });
};
