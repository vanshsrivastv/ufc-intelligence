"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartPalette } from "@ufc-intelligence/ui-tokens";

export function EloHistoryChart({ history }: { history: { date: string; elo: number }[] }) {
  // A single point can't draw a meaningful line - same "not enough to
  // chart" bar the other Elo displays set at "no data at all" (null),
  // but this one specifically needs two points to show a trend.
  if (history.length < 2) return null;

  const data = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    elo: Math.round(h.elo),
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={chartPalette.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#B4B2A9", fontSize: 10 }}
            axisLine={{ stroke: chartPalette.grid }}
            tickLine={false}
            interval={Math.ceil(data.length / 6) - 1}
          />
          <YAxis
            domain={["dataMin - 20", "dataMax + 20"]}
            tick={{ fill: "#B4B2A9", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
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
            formatter={(value: number) => [value, "Elo"]}
          />
          <Line
            type="monotone"
            dataKey="elo"
            stroke={chartPalette.primarySeries}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
