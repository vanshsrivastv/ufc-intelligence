"use client";

import { useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { chartPalette } from "@ufc-intelligence/ui-tokens";
import type { ComparePercentilesDto, StatPercentiles } from "@ufc-intelligence/types";

const CORE_METRICS: { key: keyof StatPercentiles; label: string }[] = [
  { key: "elo", label: "Elo" },
  { key: "strikeAccuracy", label: "Strike accuracy" },
  { key: "takedownAccuracy", label: "Takedown accuracy" },
  { key: "takedownDefense", label: "Takedown defense" },
  { key: "finishRate", label: "Finish rate" },
  { key: "winRate", label: "Win %" },
];

const EXTRA_METRICS: { key: keyof StatPercentiles; label: string }[] = [
  { key: "strikesLandedPerMin", label: "Strikes landed/min" },
  { key: "takedownAvg", label: "Takedown avg" },
  { key: "submissionAvg", label: "Submission avg" },
  { key: "koRate", label: "KO rate" },
  { key: "submissionRate", label: "Submission rate" },
  { key: "decisionRate", label: "Decision rate" },
];

export function StatRadarChart({
  percentiles,
  nameA,
  nameB,
}: {
  percentiles: ComparePercentilesDto;
  nameA: string;
  nameB: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const metrics = expanded ? [...CORE_METRICS, ...EXTRA_METRICS] : CORE_METRICS;

  // Every axis is a percentile against the WHOLE roster (see
  // fighters.service.ts's getComparePercentiles) - not raw values, not
  // weight-class-scoped yet (a planned follow-up). An axis is dropped
  // entirely, for both fighters, rather than drawn with a guessed value,
  // whenever either fighter has insufficient underlying data for it -
  // same "never fabricate" rule every other Elo/stat display in this app
  // already follows.
  const data = metrics
    .map((m) => ({
      label: m.label,
      a: percentiles.fighterA[m.key],
      b: percentiles.fighterB[m.key],
    }))
    .filter((d): d is { label: string; a: number; b: number } => d.a !== null && d.b !== null);

  const hiddenCount = metrics.length - data.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-heading-md text-text-primary">Stat comparison</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
        >
          {expanded ? "Show fewer stats" : "Show all stats"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartPalette.primarySeries }} />
          {nameA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartPalette.comparisonSeries }} />
          {nameB}
        </span>
      </div>

      {data.length < 3 ? (
        <p className="mt-4 text-body-md text-text-muted">
          Not enough shared stat data between these two fighters to chart.
        </p>
      ) : (
        <div className="mt-2 h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke={chartPalette.grid} />
              <PolarAngleAxis dataKey="label" tick={{ fill: "#B4B2A9", fontSize: 11 }} />
              {/* Domain locked to 0-100, not left to auto-scale to the
                  data's own min/max - these are percentiles, so a fixed
                  0-100 axis is the only way the shape stays honestly
                  comparable across different fighter pairs. */}
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name={nameA}
                dataKey="a"
                stroke={chartPalette.primarySeries}
                fill={chartPalette.primarySeries}
                fillOpacity={0.22}
                strokeWidth={2}
              />
              <Radar
                name={nameB}
                dataKey="b"
                stroke={chartPalette.comparisonSeries}
                fill={chartPalette.comparisonSeries}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background: "#1C1C19",
                  border: "0.5px solid #2A2620",
                  borderRadius: 4,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#F2F0EA" }}
                itemStyle={{ color: "#F2F0EA" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 text-[11px] text-text-muted">
        Each axis is percentile rank against every rated fighter in the database - not raw values,
        and not yet scoped to weight class.
        {hiddenCount > 0 &&
          ` ${hiddenCount} stat${hiddenCount === 1 ? "" : "s"} hidden - insufficient data for one fighter.`}
      </p>
    </div>
  );
}
