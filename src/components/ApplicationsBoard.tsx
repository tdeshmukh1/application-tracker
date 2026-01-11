"use client";

import { useMemo, useState, useTransition } from "react";

type ApplicationStatus = "applied" | "accepted" | "rejected";

type ApplicationRow = {
  id: number;
  company: string;
  role: string;
  status: ApplicationStatus;
  createdAt: string | null;
};

const statusColumns: { key: ApplicationStatus; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Unknown date";

export default function ApplicationsBoard({
  initialRows,
}: {
  initialRows: ApplicationRow[];
}) {
  const [rows, setRows] = useState<ApplicationRow[]>(initialRows);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    return statusColumns.reduce(
      (acc, column) => {
        acc[column.key] = rows.filter((row) => row.status === column.key);
        return acc;
      },
      {} as Record<ApplicationStatus, ApplicationRow[]>
    );
  }, [rows]);

  const updateStatus = (id: number, status: ApplicationStatus) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, status } : row))
    );

    startTransition(async () => {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        setMessage("Update failed. Try again.");
      } else {
        setMessage(null);
      }
    });
  };

  const deleteApplication = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id));

    startTransition(async () => {
      const response = await fetch(`/api/applications/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setMessage("Delete failed. Try again.");
      } else {
        setMessage(null);
      }
    });
  };

  const handleDrop =
    (status: ApplicationStatus) => (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const id = Number(event.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(id)) {
        updateStatus(id, status);
      }
    };

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 font-sans">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Applications
          </h1>
          <p className="text-sm text-zinc-600">
            Drag cards between columns to update their status.
          </p>
        </header>

        {rows.length === 0 ? (
          <section className="mt-8">
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
              No applications yet. Run a sync to pull Gmail data.
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-6 lg:grid-cols-3">
            {statusColumns.map((column) => (
              <div
                key={column.key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop(column.key)}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <h2 className="text-sm font-semibold text-zinc-800">
                    {column.label}
                  </h2>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                    {grouped[column.key].length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {grouped[column.key].length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      No items in this column yet.
                    </p>
                  ) : (
                    grouped[column.key].map((row) => (
                      <article
                        key={row.id}
                        draggable
                        onDragStart={(event) =>
                          event.dataTransfer.setData(
                            "text/plain",
                            String(row.id)
                          )
                        }
                        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold text-zinc-900">
                            {row.company}
                          </h3>
                          <button
                            type="button"
                            onClick={() => deleteApplication(row.id)}
                            aria-label="Delete application"
                            className="rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                          >
                            ×
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">
                          {row.role}
                        </p>
                        <p className="mt-3 text-[11px] text-zinc-400">
                          {formatDate(row.createdAt)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {message ? (
          <p className="mt-6 text-sm text-zinc-600">{message}</p>
        ) : null}

        {isPending ? (
          <p className="mt-2 text-xs text-zinc-400">Saving changes...</p>
        ) : null}
      </div>
    </main>
  );
}
