import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
} from 'recharts';
import { format } from 'date-fns';

interface HistoryItem {
  id: number;
  city: string;
  lat?: number;
  lon?: number;
  temp: number;
  humidity: number;
  rainfall: number;
  pressure: number;
  river_level: number;
  risk_level: 'Low' | 'Medium' | 'High';
  timestamp: string;
}

interface HistoryChartProps {
  data: HistoryItem[];
}

export default function HistoryChart({ data }: HistoryChartProps) {
  const chartData = [...data].reverse().map((item) => ({
    ...item,
    displayTime: format(new Date(item.timestamp), 'MMM d, HH:mm'),
    riskScore: item.risk_level === 'High' ? 3 : item.risk_level === 'Medium' ? 2 : 1,
  }));

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-400 italic bg-slate-950 rounded-xl border border-slate-800">
        No historical data available for visualization.
      </div>
    );
  }

  return (
    <div className="h-[380px] w-full bg-slate-950 border border-slate-800 p-4 rounded-xl">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
          <XAxis
            dataKey="displayTime"
            fontSize={11}
            tick={{ fill: '#94a3b8' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            fontSize={11}
            tick={{ fill: '#94a3b8' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            label={{
              value: 'Temp (°C) / Rain (mm)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#94a3b8', fontSize: 11, fontWeight: 600 },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            fontSize={11}
            tick={{ fill: '#94a3b8' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            label={{
              value: 'Humidity (%)',
              angle: 90,
              position: 'insideRight',
              style: { fill: '#94a3b8', fontSize: 11, fontWeight: 600 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '12px',
            }}
            cursor={{ stroke: '#334155', strokeWidth: 1 }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}
          />

          <Bar
            yAxisId="left"
            dataKey="rainfall"
            name="Rainfall (mm)"
            fill="#0284c7"
            radius={[4, 4, 0, 0]}
            barSize={20}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="humidity"
            name="Humidity (%)"
            fill="#6366f1"
            stroke="#6366f1"
            fillOpacity={0.14}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="temp"
            name="Temperature (°C)"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 1.5, stroke: '#0f172a' }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="left"
            type="stepAfter"
            dataKey="river_level"
            name="River Level (m)"
            stroke="#22d3ee"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
