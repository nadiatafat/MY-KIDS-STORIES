import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Send, Loader2, Image as ImageIcon, Film, RefreshCw, Heart, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateStory, generateImage, generateVideo } from './services/gemini';
import { StoryResponse, AppState } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [input, setInput] = useState('');
  const [state, setState] = useState<AppState>('idle');
  const [story, setStory] = useState<StoryResponse | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleCreateMagic = async () => {
    if (!input.trim()) return;
    
    if (!hasKey && window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      // Proceed after opening key selector as per guidelines
    }

    setError(null);
    setStory(null);
    setImageUrl(null);
    setVideoUrl(null);
    
    try {
      setState('generating_story');
      const storyData = await generateStory(input);
      setStory(storyData);

      setState('generating_image');
      const img = await generateImage(storyData.nano_banana_prompt);
      setImageUrl(img);

      setState('generating_video');
      const vid = await generateVideo(storyData.veo_motion, img);
      setVideoUrl(vid);

      setState('ready');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur magique est survenue...");
      setState('idle');
    }
  };

  const reset = () => {
    setState('idle');
    setInput('');
    setStory(null);
    setImageUrl(null);
    setVideoUrl(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-magic-bg text-slate-100 selection:bg-magic-pink/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-magic-purple/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-magic-pink/20 blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <header className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-xs font-medium tracking-wider uppercase text-magic-purple mb-4"
          >
            <Sparkles size={14} />
            L'aventure commence ici
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-serif font-bold mb-4 magic-text"
          >
            My Kids Story
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg max-w-xl mx-auto"
          >
            Transforme tes émotions en une aventure magique dont tu es le héros.
          </motion.p>
        </header>

        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="input-section"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-3xl p-8 md:p-12 shadow-2xl"
            >
              <div className="space-y-6">
                <div>
                  <label htmlFor="situation" className="block text-sm font-medium text-slate-400 mb-2 ml-1">
                    Que s'est-il passé aujourd'hui ?
                  </label>
                  <textarea
                    id="situation"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ex: J'ai perdu mon doudou bleu..."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-lg focus:outline-none focus:ring-2 focus:ring-magic-purple/50 transition-all resize-none placeholder:text-slate-600"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-4 rounded-xl border border-red-400/20">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleCreateMagic}
                  disabled={!input.trim()}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-magic-purple to-magic-pink p-px rounded-2xl transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="bg-magic-bg/80 group-hover:bg-transparent transition-colors rounded-[15px] py-4 flex items-center justify-center gap-3 font-semibold text-lg">
                    <Sparkles className="group-hover:animate-pulse" />
                    Créer la Magie
                  </div>
                </button>
                
                {!hasKey && (
                  <p className="text-center text-xs text-slate-500">
                    Note: Une clé API payante est requise pour la génération vidéo.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {state !== 'idle' && (
            <motion.div
              key="result-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Progress Indicator */}
              <div className="flex justify-between items-center px-2">
                <div className="flex gap-2">
                  <StepIndicator active={state === 'generating_story'} completed={!!story} label="Histoire" icon={<Send size={14} />} />
                  <StepIndicator active={state === 'generating_image'} completed={!!imageUrl} label="Image" icon={<ImageIcon size={14} />} />
                  <StepIndicator active={state === 'generating_video'} completed={!!videoUrl} label="Animation" icon={<Film size={14} />} />
                </div>
                {state === 'ready' && (
                  <button onClick={reset} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm">
                    <RefreshCw size={16} /> Recommencer
                  </button>
                )}
              </div>

              {/* Story Content */}
              {story && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card rounded-3xl overflow-hidden"
                >
                  <div className="p-8 md:p-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-magic-pink/20 flex items-center justify-center text-magic-pink">
                        <Heart size={20} fill="currentColor" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-serif font-bold text-white">{story.titre}</h2>
                        <p className="text-xs text-magic-purple uppercase tracking-widest font-bold">{story.emotion}</p>
                      </div>
                    </div>
                    <p className="text-xl leading-relaxed text-slate-300 font-serif italic">
                      "{story.histoire}"
                    </p>
                  </div>

                  {/* Visuals */}
                  <div className="aspect-video relative bg-black/40 group">
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-cover"
                      />
                    ) : imageUrl ? (
                      <div className="relative w-full h-full">
                        <img
                          src={imageUrl}
                          alt="Story scene"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {state === 'generating_video' && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
                            <Loader2 className="animate-spin text-magic-purple mb-4" size={48} />
                            <h3 className="text-xl font-bold mb-2">L'animation prend vie...</h3>
                            <p className="text-slate-400 max-w-xs">Cela peut prendre une minute. Prépare-toi pour la magie !</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p>Génération des images...</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 text-center text-slate-600 text-sm">
        <p>© 2026 My Kids Story • Créé avec Magie et IA</p>
      </footer>
    </div>
  );
}

function StepIndicator({ active, completed, label, icon }: { active: boolean; completed: boolean; label: string; icon: ReactNode }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
      active ? "bg-magic-purple text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]" : 
      completed ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-500"
    )}>
      {completed ? <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-magic-bg">✓</div> : icon}
      <span className="hidden sm:inline">{label}</span>
      {active && <Loader2 size={12} className="animate-spin" />}
    </div>
  );
}
