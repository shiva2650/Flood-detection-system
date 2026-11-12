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
  Area
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
  // Prepare data for the chart: reverse to show chronological order
  const chartData = [...data].reverse().map(item => ({
    ...item,
    displayTime: format(new Date(item.timestamp), 'MMM d, HH:mm'),
    riskScore: item.risk_level === 'High' ? 3 : item.risk_level === 'Medium' ? 2 : 1
  }));

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
        No historical data available for visualization.
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="displayTime" 
            fontSize={10} 
            tick={{ fill: '#94a3b8' }} 
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis 
            yAxisId="left" 
            fontSize={10} 
            tick={{ fill: '#94a3b8' }} 
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            label={{ value: 'Temp (°C) / Rain (mm)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 10, fontWeight: 600 } }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            fontSize={10} 
            tick={{ fill: '#94a3b8' }} 
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight', style: { fill: '#94a3b8', fontSize: 10, fontWeight: 600 } }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
          />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle" 
            wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          />
          
          <Bar 
            yAxisId="left" 
            dataKey="rainfall" 
            name="Rainfall (mm)" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
          <Area 
            yAxisId="right"
            type="monotone"
            dataKey="humidity"
            name="Humidity (%)"
            fill="#818cf8"
            stroke="#818cf8"
            fillOpacity={0.1}
          />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="temp" 
            name="Temperature (°C)" 
            stroke="#f59e0b" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line 
            yAxisId="left" 
            type="stepAfter" 
            dataKey="river_level" 
            name="River Level (m)" 
            stroke="#06b6d4" 
            strokeWidth={2} 
            strokeDasharray="5 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
