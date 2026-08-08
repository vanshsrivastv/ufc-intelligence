"use client";

import { useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "LIVE", label: "Live" },
  { value: "COMPLETED", label: "Completed" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "date_asc", label: "Date (soonest first)" },
  { value: "date_desc", label: "Date (latest first)" },
  { value: "recent", label: "Recently added" },
];

export function EventFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  // Mirrors the API's status-dependent default (see events.service.ts) so
  // the dropdown shows the order actually being applied rather than
  // claiming "soonest first" while All/Completed come back newest-first.
  const sort =
    searchParams.get("sort") ?? (status === "UPCOMING" ? "date_asc" : "date_desc");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/events${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setParam("status", opt.value)}
          aria-pressed={status === opt.value}
          className={`rounded-md border px-3 py-1.5 text-xs transition-standard ${
            status === opt.value
              ? "border-gold-500 bg-gold-900 text-gold-300"
              : "border-border text-text-secondary hover:border-border-strong"
          }`}
        >
          {opt.label}
        </button>
      ))}

      <select
        value={sort}
        onChange={(e) => setParam("sort", e.target.value)}
        className="ml-auto rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none transition-standard focus:border-gold-500"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort: {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
