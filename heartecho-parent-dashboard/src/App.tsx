import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { UserProfile, Session, Insight } from './types';
import { generateWeeklyInsight } from './services/geminiService';
import EmotionalEvolution from './components/EmotionalEvolution';
import WeeklyInsight from './components/WeeklyInsight';
import StoryWorldProgression from './components/StoryWorldProgression';
import ThemesOverview from './components/ThemesOverview';
import { LogIn, LogOut, Heart, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Parent',
          childName: 'Leo', // Default for demo
          createdAt: new Date().toISOString()
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setSessions(sessionData);
    });

    const insightsQuery = query(
      collection(db, 'insights'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribeInsights = onSnapshot(insightsQuery, (snapshot) => {
      if (!snapshot.empty) {
        setInsight({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Insight);
      }
    });

    return () => {
      unsubscribeSessions();
      unsubscribeInsights();
    };
  }, [user]);

  const handleLogin = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      // Ignore cancellation errors as they are user-initiated or browser-blocked
      if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
        console.error("Login failed", error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const generateNewInsight = async () => {
    if (!user || sessions.length === 0) return;
    setGeneratingInsight(true);
    try {
      const newInsight = await generateWeeklyInsight(sessions, user.childName || 'your child');
      await addDoc(collection(db, 'insights'), {
        userId: user.uid,
        weekStartDate: new Date().toISOString().split('T')[0],
        ...newInsight,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Insight generation failed", error);
    } finally {
      setGeneratingInsight(false);
    }
  };

  const injectMockData = async () => {
    if (!user) return;
    const mockSessions: Partial<Session>[] = [
      { emotion: 'Joy', topic: 'The Floating Mountains', summary: 'Leo felt brave exploring new heights.', storyTitle: 'The Brave Cloud-Walker', character: 'Pip the Squirrel', intensity: 8, timestamp: new Date(Date.now() - 86400000 * 4).toISOString() },
      { emotion: 'Fear', topic: 'The Shadow Forest', summary: 'Leo was worried about the dark, but found a lantern.', storyTitle: 'The Lantern of Hope', character: 'Pip the Squirrel', intensity: 6, timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
      { emotion: 'Calm', topic: 'The Crystal Lake', summary: 'A peaceful moment by the water.', storyTitle: 'The Singing Stones', character: 'Luna the Owl', intensity: 9, timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
      { emotion: 'Excited', topic: 'The Sky Carnival', summary: 'Leo celebrated a big victory.', storyTitle: 'The Great Balloon Race', character: 'Pip the Squirrel', intensity: 10, timestamp: new Date(Date.now() - 86400000 * 1).toISOString() },
    ];

    for (const s of mockSessions) {
      await addDoc(collection(db, 'sessions'), { ...s, userId: user.uid });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-cream">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-garden-sage"
        >
          <Heart size={48} fill="currentColor" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-cream text-garden-ink pb-20">
      {/* Navigation */}
      <nav className="border-b border-garden-mist bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-garden-sage rounded-xl flex items-center justify-center text-white">
              <Heart size={20} fill="currentColor" />
            </div>
            <h1 className="serif text-2xl font-semibold tracking-tight">HeartEcho</h1>
          </div>
          
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-garden-sage hidden md:block">Welcome, {user.displayName}</span>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-garden-mist rounded-full transition-colors text-garden-sage"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              disabled={signingIn}
              className="flex items-center gap-2 bg-garden-sage text-white px-6 py-2.5 rounded-full font-medium hover:bg-garden-sage/90 transition-all shadow-sm disabled:opacity-50"
            >
              {signingIn ? <RefreshCw size={18} className="animate-spin" /> : <LogIn size={18} />}
              <span>{signingIn ? 'Connecting...' : 'Parent Login'}</span>
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-12">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div 
              key="login-prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20"
            >
              <h2 className="serif text-5xl mb-6 text-garden-sage">A Window into Their World</h2>
              <p className="text-garden-sage/70 max-w-xl mx-auto text-lg leading-relaxed mb-10">
                HeartEcho transforms your child's emotions into personalized stories. 
                Log in to see their emotional growth and narrative journey.
              </p>
              <button 
                onClick={handleLogin}
                disabled={signingIn}
                className="bg-garden-sage text-white px-10 py-4 rounded-full text-lg font-medium hover:scale-105 transition-transform shadow-lg shadow-garden-sage/20 disabled:opacity-50 disabled:scale-100"
              >
                {signingIn ? 'Connecting...' : 'Connect to Dashboard'}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              {/* Header */}
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className="serif text-5xl text-garden-sage mb-2">{user.childName}'s Garden</h2>
                  <p className="text-garden-sage/60 font-medium tracking-wide uppercase text-xs">Emotional & Narrative Growth</p>
                </div>
                <div className="flex gap-3">
                  {sessions.length === 0 && (
                    <button 
                      onClick={injectMockData}
                      className="flex items-center gap-2 bg-white border border-garden-mist px-4 py-2 rounded-xl text-sm font-medium hover:bg-garden-mist transition-colors"
                    >
                      <Sparkles size={16} className="text-garden-sage" />
                      <span>Demo: Inject Data</span>
                    </button>
                  )}
                  <button 
                    onClick={generateNewInsight}
                    disabled={generatingInsight || sessions.length === 0}
                    className="flex items-center gap-2 bg-garden-sage text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-garden-sage/90 transition-all disabled:opacity-50"
                  >
                    {generatingInsight ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>Refresh Insights</span>
                  </button>
                </div>
              </header>

              {/* Weekly Insight - Hero Section */}
              <WeeklyInsight insight={insight} isLoading={generatingInsight} />

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Column: Emotional Evolution */}
                <div className="lg:col-span-2 space-y-10">
                  <EmotionalEvolution sessions={sessions} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <ThemesOverview sessions={sessions} />
                    <div className="bg-garden-petal/30 p-8 rounded-3xl border border-garden-petal flex flex-col justify-center">
                      <h3 className="serif text-2xl mb-4 text-garden-sage">Parent Tip</h3>
                      <p className="text-garden-sage/80 italic leading-relaxed">
                        "Leo has been exploring themes of 'Courage' this week. When you see them trying something new, mention Pip the Squirrel's bravery."
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Narrative Continuity */}
                <div className="space-y-10">
                  <StoryWorldProgression sessions={sessions} />
                  <div className="bg-white p-6 rounded-3xl border border-garden-mist text-center">
                    <div className="w-16 h-16 bg-garden-mist rounded-full flex items-center justify-center mx-auto mb-4 text-garden-sage">
                      <Heart size={24} />
                    </div>
                    <h4 className="serif text-xl mb-2">Safe & Secure</h4>
                    <p className="text-xs text-garden-sage/60 leading-relaxed px-4">
                      All session data is encrypted and used only to personalize your child's experience.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
