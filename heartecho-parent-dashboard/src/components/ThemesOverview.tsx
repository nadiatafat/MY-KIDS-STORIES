import React from 'react';
import { Session } from '../types';

interface Props {
  sessions: Session[];
}

export default function ThemesOverview({ sessions }: Props) {
  const themes = sessions.reduce((acc, s) => {
    acc[s.topic] = (acc[s.topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedThemes = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-garden-mist">
      <h3 className="serif text-2xl mb-6 text-garden-sage">Recurring Themes</h3>
      <div className="flex flex-wrap gap-3">
        {sortedThemes.map(([theme, count]) => (
          <div 
            key={theme}
            className="px-4 py-2 rounded-full border border-garden-sage/20 bg-garden-cream text-garden-sage text-sm flex items-center gap-2"
          >
            <span className="font-medium">{theme}</span>
            <span className="w-5 h-5 rounded-full bg-garden-sage text-white text-[10px] flex items-center justify-center">
              {count}
            </span>
          </div>
        ))}
        {sortedThemes.length === 0 && (
          <p className="text-sm text-garden-sage/60 italic">No themes identified yet.</p>
        )}
      </div>
    </div>
  );
}
