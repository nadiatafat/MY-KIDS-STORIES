import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Session } from '../types';
import { format } from 'date-fns';

interface Props {
  sessions: Session[];
}

const emotionColors: Record<string, string> = {
  Joy: '#FCD34D',
  Fear: '#A78BFA',
  Anger: '#F87171',
  Sadness: '#60A5FA',
  Calm: '#34D399',
  Excited: '#FB923C',
  Frustrated: '#94A3B8'
};

export default function EmotionalEvolution({ sessions }: Props) {
  const data = sessions.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(s => ({
    date: format(new Date(s.timestamp), 'MMM d'),
    intensity: s.intensity,
    emotion: s.emotion,
    color: emotionColors[s.emotion] || '#94A3B8'
  }));

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-garden-mist h-[400px]">
      <h3 className="serif text-2xl mb-6 text-garden-sage">Emotional Landscapes</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EBE4" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#5A5A40', fontSize: 12 }}
              dy={10}
            />
            <YAxis hide domain={[0, 10]} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-white p-3 rounded-xl shadow-lg border border-garden-mist">
                      <p className="text-xs font-semibold uppercase tracking-wider text-garden-sage mb-1">{item.date}</p>
                      <p className="serif text-lg" style={{ color: item.color }}>{item.emotion}</p>
                      <p className="text-xs text-garden-ink/60">Intensity: {item.intensity}/10</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line 
              type="monotone" 
              dataKey="intensity" 
              stroke="#5A5A40" 
              strokeWidth={2} 
              dot={{ r: 4, fill: '#5A5A40', strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
