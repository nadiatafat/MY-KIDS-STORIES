import React from 'react';
import { Session } from '../types';
import { BookOpen, MapPin, User } from 'lucide-react';

interface Props {
  sessions: Session[];
}

export default function StoryWorldProgression({ sessions }: Props) {
  const latestSessions = sessions.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 3);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-garden-mist">
      <h3 className="serif text-2xl mb-6 text-garden-sage">Narrative Continuity</h3>
      
      <div className="space-y-6">
        {latestSessions.map((session, idx) => (
          <div key={idx} className="group cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-garden-mist flex items-center justify-center shrink-0 group-hover:bg-garden-sage group-hover:text-white transition-colors">
                <BookOpen size={20} />
              </div>
              <div className="flex-1 border-b border-garden-mist pb-4 group-last:border-0">
                <p className="text-[10px] uppercase font-bold tracking-widest text-garden-sage/60 mb-1">
                  {new Date(session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
                <h4 className="serif text-xl mb-2">{session.storyTitle}</h4>
                <div className="flex gap-4 text-xs text-garden-ink/60">
                  <span className="flex items-center gap-1">
                    <User size={12} /> {session.character}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {session.topic}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
