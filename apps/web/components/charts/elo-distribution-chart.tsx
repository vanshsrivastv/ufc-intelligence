"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartPalette } from "@ufc-intelligence/ui-tokens";
import type { EloDistributionBucket } from "@/lib/api-client";

export function EloDistributionChart({ buckets }: { buckets: EloDistributionBucket[] }) {
  if (buckets.length === 0) {
    return (
      <p className="text-body-md text-text-muted">
        No fighters have a computed Elo rating yet.
      </p>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={chartPalette.grid} vertical={false} />
          <XAxis
            dataKey="bucketLabel"
            tick={{ fill: "#B4B2A9", fontSize: 10 }}
            axisLine={{ stroke: chartPalette.grid }}
            tickLine={false}
            interval={Math.ceil(buckets.length / 8) - 1}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#B4B2A9", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: "rgba(232, 197, 114, 0.08)" }}
            contentStyle={{
              background: "#1C1C19",
              border: "0.5px solid #2A2620",
              borderRadius: 4,
              fontSize: 12,
            }}
            labelStyle={{ color: "#F2F0EA" }}
            itemStyle={{ color: "#F2F0EA" }}
            formatter={(value: number) => [`${value} fighter${value === 1 ? "" : "s"}`, "Count"]}
          />
          <Bar dataKey="count" fill={chartPalette.primarySeries} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
