import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { accounts, applications, users } from "@/db/schema";
import { classifyApplicationEmail } from "@/lib/gptClassifier";

const GMAIL_QUERY =
  'newer_than:2y (application OR interview OR offer OR rejection OR "thank you for applying" OR "we received") -category:promotions -category:social';

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessage = {
  id: string;
  snippet?: string;
  payload?: {
    body?: { data?: string };
    mimeType?: string;
    parts?: GmailPayloadPart[];
    headers?: GmailHeader[];
  };
};

type GmailPayloadPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
};

const getHeader = (headers: GmailHeader[] | undefined, name: string) =>
  headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())
    ?.value ?? "";

const parseCompany = (fromHeader: string) => {
  const match = fromHeader.match(/^(.*)<(.+)>/);
  if (match) {
    const displayName = match[1].trim().replace(/^"|"$/g, "");
    if (displayName) {
      return displayName;
    }
    const email = match[2];
    return email.split("@")[1]?.split(".")[0] ?? "Unknown";
  }
  if (fromHeader.includes("@")) {
    return fromHeader.split("@")[1]?.split(".")[0] ?? "Unknown";
  }
  return fromHeader.trim() || "Unknown";
};

const decodeBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64").toString("utf-8");
};

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const extractBodyFromPayload = (payload?: GmailPayloadPart): string => {
  if (!payload) {
    return "";
  }

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      return stripHtml(decoded);
    }
    return decoded;
  }

  for (const part of payload.parts ?? []) {
    const text = extractBodyFromPayload(part);
    if (text) {
      return text;
    }
  }

  return "";
};

const parseStatus = (subject: string, snippet: string) => {
  const haystack = `${subject} ${snippet}`.toLowerCase();
  if (
    haystack.includes("rejected") ||
    haystack.includes("not selected") ||
    haystack.includes("unfortunately") ||
    haystack.includes("declined")
  ) {
    return "rejected";
  }
  if (
    haystack.includes("offer") ||
    haystack.includes("accepted") ||
    haystack.includes("congratulations")
  ) {
    return "accepted";
  }
  return "applied";
};

const isLikelyJobEmail = (subject: string, snippet: string) => {
  const haystack = `${subject} ${snippet}`.toLowerCase();
  const positiveSignals = [
    "application",
    "applied",
    "interview",
    "assessment",
    "offer",
    "rejection",
    "position",
    "role",
    "candidate",
    "resume",
  ];
  const negativeSignals = [
    "sale",
    "discount",
    "promo",
    "order",
    "receipt",
    "newsletter",
    "subscription",
    "shipping",
    "invoice",
    "advert",
    "deal",
  ];

  const hasPositive = positiveSignals.some((word) => haystack.includes(word));
  const hasNegative = negativeSignals.some((word) => haystack.includes(word));

  return hasPositive && !hasNegative;
};

const getAccessToken = async (account: {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  userId: string;
  provider: string;
  providerAccountId: string;
}) => {
  const expiresAtMs = account.expires_at ? account.expires_at * 1000 : 0;
  if (account.access_token && expiresAtMs > Date.now() + 60_000) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error("Missing refresh token. Re-authenticate with Google.");
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: account.refresh_token,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token refresh failed");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600);

  await db
    .update(accounts)
    .set({
      access_token: data.access_token,
      expires_at: expiresAt,
    })
    .where(
      and(
        eq(accounts.userId, account.userId),
        eq(accounts.provider, account.provider),
        eq(accounts.providerAccountId, account.providerAccountId)
      )
    );

  return data.access_token;
};

const fetchJson = async <T>(url: string, accessToken: string) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
};

export const syncGmailApplications = async () => {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    throw new Error("Not authenticated");
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    throw new Error("User not found");
  }

  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.provider, "google")))
    .limit(1)
    .then((rows) => rows[0]);

  if (!account) {
    throw new Error("Google account not linked");
  }

  const accessToken = await getAccessToken({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expires_at: account.expires_at,
    userId: account.userId,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
  });

  const listUrl = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages"
  );
  listUrl.searchParams.set("q", GMAIL_QUERY);
  listUrl.searchParams.set("maxResults", "25");

  const list = await fetchJson<{ messages?: { id: string }[] }>(
    listUrl.toString(),
    accessToken
  );

  const messages = list.messages ?? [];

  let created = 0;

  for (const message of messages) {
    const messageUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`
    );
    messageUrl.searchParams.set("format", "full");

    const fullMessage = await fetchJson<GmailMessage>(
      messageUrl.toString(),
      accessToken
    );

    const headers = fullMessage.payload?.headers ?? [];
    const subject = getHeader(headers, "Subject");
    const from = getHeader(headers, "From");
    const dateHeader = getHeader(headers, "Date");
    const snippet = fullMessage.snippet ?? "";
    const body = extractBodyFromPayload(fullMessage.payload);

    const classification = await classifyApplicationEmail({
      subject,
      from,
      snippet,
      body,
    });

    if (classification?.isJob === false) {
      continue;
    }

    if (!classification && !isLikelyJobEmail(subject, snippet)) {
      continue;
    }

    const company =
      (classification?.company &&
      classification.company.toLowerCase() !== "unknown"
        ? classification.company
        : parseCompany(from)) || "Unknown";
    const role =
      (classification?.role &&
      classification.role.toLowerCase() !== "unknown"
        ? classification.role
        : subject || snippet || "Unknown role") || "Unknown role";
    const status = classification?.status ?? parseStatus(subject, snippet);

    const createdAt = Number.isNaN(Date.parse(dateHeader))
      ? undefined
      : new Date(dateHeader);

    const result = await db
      .insert(applications)
      .values({
        company,
        role,
        status,
        sourceMessageId: message.id,
        ...(createdAt ? { createdAt } : {}),
      })
      .onConflictDoNothing({
        target: applications.sourceMessageId,
      });

    if (result.rowCount && result.rowCount > 0) {
      created += 1;
    }
  }

  return { created, checked: messages.length };
};
