import React from 'react';
import { motion } from 'motion/react';
import { Insight } from '../types';
import { Sparkles, Quote } from 'lucide-react';

interface Props {
  insight: Insight | null;
  isLoading: boolean;
}

export default function WeeklyInsight({ insight, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-garden-mist/30 p-8 rounded-3xl border border-dashed border-garden-sage/30 animate-pulse">
        <div className="h-4 w-32 bg-garden-sage/10 rounded mb-4" />
        <div className="h-8 w-full bg-garden-sage/10 rounded mb-2" />
        <div className="h-8 w-2/3 bg-garden-sage/10 rounded" />
      </div>
    );
  }

  if (!insight) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-garden-mist/30 p-8 rounded-3xl border border-garden-sage/20 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={120} className="text-garden-sage" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-garden-sage/60">Weekly Whisper</span>
          <div className="h-[1px] flex-1 bg-garden-sage/20" />
        </div>

        <h2 className="serif text-3xl md:text-4xl text-garden-sage mb-6 leading-tight">
          "{insight.summary}"
        </h2>

        <div className="flex gap-4 items-start bg-white/50 p-6 rounded-2xl border border-white">
          <Quote className="text-garden-sage/40 shrink-0" size={24} />
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-garden-sage/60 mb-2">Conversation Starter</p>
            <p className="serif text-xl text-garden-ink italic">
              {insight.conversationStarter}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
