"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function StatsBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5B6B63" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#5B6B63" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(44,104,201,.06)" }} contentStyle={{ borderRadius: 10, border: "1px solid #E2E8E5", fontSize: 12 }} />
          <Bar dataKey="value" fill="#2C68C9" radius={[5, 5, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
