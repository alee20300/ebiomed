"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface Props {
  completed: number
  total: number
}

const COLORS = ["#22c55e", "#e5e7eb"]

export function ComplianceChart({ completed, total }: Props) {
  const pending = Math.max(total - completed, 0)
  const data = [
    { name: "Completed", value: completed },
    { name: "Pending", value: pending },
  ]

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No PM schedules defined yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
