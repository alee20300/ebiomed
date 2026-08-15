"use client"

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { GroupMetric } from "@/lib/reports/calculations"

const COLORS = ["#2563eb", "#16a34a", "#f97316", "#dc2626", "#7c3aed", "#0891b2", "#ca8a04", "#be123c"]

export function ReportPieChart({ data }: { data: GroupMetric[] }) {
  if (data.every((row) => row.value === 0)) {
    return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No data in this range.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={56} outerRadius={86} paddingAngle={2}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ReportBarChart({ data, valueLabel = "Value" }: { data: GroupMetric[]; valueLabel?: string }) {
  if (data.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No data in this range.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 8, right: 12, top: 12, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={72} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => [value, valueLabel]} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
