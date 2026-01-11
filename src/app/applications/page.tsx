import ApplicationsBoard from "@/components/ApplicationsBoard";
import { db } from "@/db";
import { applications } from "@/db/schema";

export default async function ApplicationsPage() {
  const rows = await db.select().from(applications);
  const initialRows = rows.map((row) => ({
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }));

  return (
    <ApplicationsBoard initialRows={initialRows} />
  );
}
