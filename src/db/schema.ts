import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const applicationStatus = pgEnum("application_status", [
  "applied",
  "accepted",
  "rejected",
]);

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  status: applicationStatus("status").notNull().default("applied"),
  sourceMessageId: text("source_message_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
