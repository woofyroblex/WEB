import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = { name: string; count: number; fill: string };

export default function ProjectChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#edf0ec" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#7b8982", fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#9aa49e", fontSize: 11 }}
        />
        <Tooltip cursor={{ fill: "#f5f7f4" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={54}>
          {data.map((point) => (
            <Cell key={point.name} fill={point.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
