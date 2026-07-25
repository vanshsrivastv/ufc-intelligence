"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chartPalette } from "@ufc-intelligence/ui-tokens";

export function MethodBreakdownChart({
  koTko,
  submission,
  decision,
}: {
  koTko: number;
  submission: number;
  decision: number;
}) {
  const data = [
    { name: "KO/TKO", value: koTko },
    { name: "Submission", value: submission },
    { name: "Decision", value: decision },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="text-body-md text-text-muted">
        No completed wins recorded yet.
      </p>
    );
  }

  const colors = [chartPalette.primarySeries, "#8A7A55", chartPalette.comparisonSeries];

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} stroke="none" />
            ))}
          </Pie>
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
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-4">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="text-[11px] text-text-secondary">
              {d.name} ({d.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}