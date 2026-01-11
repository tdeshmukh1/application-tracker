"use client";

import { useState, useTransition } from "react";

const formatMessage = (created: number, checked: number) => {
  if (checked === 0) {
    return "No matching emails found.";
  }
  if (created === 0) {
    return `Checked ${checked} emails, no new applications.`;
  }
  return `Saved ${created} new applications from ${checked} emails.`;
};

export default function SyncButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/gmail/sync", {
        method: "POST",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as
        | { created: number; checked: number }
        | { error: string }
        | null;

      if (!response.ok || !data || "error" in data) {
        setMessage((data && "error" in data && data.error) || "Sync failed.");
        return;
      }

      setMessage(formatMessage(data.created, data.checked));
    });
  };

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isPending ? "Syncing..." : "Sync Gmail"}
      </button>
      {message ? (
        <p className="text-sm text-zinc-600">{message}</p>
      ) : null}
    </div>
  );
}
