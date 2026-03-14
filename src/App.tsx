/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  StopCircle, 
  Play, 
  BookOpen, 
  History, 
  Heart, 
  Sparkles, 
  Loader2, 
  LogOut, 
  ChevronRight,
  Volume2,
  Trash2,
  Plus,
  Settings as SettingsIcon,
  Home as HomeIcon,
  Mic2,
  Video,
  VideoOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db } from './firebase';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Story {
  id: string;
  title: string;
  content: string;
  emotion: string;
  situation: string;
  createdAt: any;
  imageUrl?: string;
  audioData?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// --- Constants ---
const STORY_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const VIDEO_MODEL = "veo-3.1-fast-generate-preview";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const AUDIO_MIME_TYPE = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string>("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [view, setView] = useState<'landing' | 'accueil' | 'home' | 'settings' | 'story'>('landing');
  const [settings, setSettings] = useState({
    childAge: '6',
    language: 'Français',
    parentalPin: '',
    enableVoice: true
  });
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- API Key Check for Veo ---
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per instructions
    }
  };

  // --- Firebase Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setView('accueil');
      } else {
        setView('landing');
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Sync ---
  useEffect(() => {
    if (!user) {
      setStories([]);
      return;
    }

    const q = query(
      collection(db, 'stories'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      setStories(storyList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'stories');
    });

    return () => unsubscribe();
  }, [user]);

  // --- Connection Test ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError("Une erreur est survenue avec la base de données. Veuillez réessayer.");
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError("Échec de la connexion.");
    }
  };

  const logout = () => signOut(auth);

  // --- Voice Recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: AUDIO_MIME_TYPE });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: AUDIO_MIME_TYPE });
        setAudioBlob(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Impossible d'accéder au microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // --- AI Engine ---
  const generateStory = async () => {
    if (!audioBlob || !user || !hasApiKey) {
      if (!hasApiKey) handleOpenKeySelector();
      return;
    }

    setIsProcessing(true);
    setError(null);
    setVideoStatus("Analyse de votre message...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // 1. Convert audio to base64
      setVideoStatus("Préparation de l'audio...");
      const reader = new FileReader();
      const base64AudioPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64AudioPromise;

      // 2. Analyze audio and generate story + video prompt
      setVideoStatus("Analyse de votre message par l'IA...");
      const storyResponse = await ai.models.generateContent({
        model: STORY_MODEL,
        contents: [
          {
            parts: [
              { inlineData: { data: base64Audio, mimeType: AUDIO_MIME_TYPE } },
              { text: `
                Analyse ce message vocal d'un enfant ou d'un parent décrivant une situation vécue.
                Identifie l'émotion principale et le défi rencontré.
                Génère une histoire courte et apaisante (environ 200 mots maximum) pour un enfant de 4 à 8 ans.
                L'histoire doit mettre en scène un personnage (animal ou enfant imaginaire) qui traverse un défi SIMILAIRE.
                
                Réponds au format JSON suivant :
                {
                  "title": "Titre de l'histoire",
                  "content": "Contenu de l'histoire en Markdown",
                  "emotion": "L'émotion identifiée",
                  "situation": "Bref résumé",
                  "videoPrompt": {
                    "project_title": "Titre de la scène",
                    "aspect_ratio": "16:9",
                    "image_goal": {
                      "purpose": "scène de conte pour enfant",
                      "primary_feeling": "apaisant et magique",
                      "viewer_impression": "émerveillement"
                    },
                    "aesthetic_theme": {
                      "style": "soft 3D animation style, Pixar-like",
                      "mood": "calm and magical",
                      "color_palette": ["pastel blue", "warm gold", "soft green"],
                      "textures": ["soft fur", "glowing light", "magical sparkles"]
                    },
                    "subject_identity": {
                      "identity_priority": "high",
                      "identity_preservation": ["character proportions", "cute features"],
                      "skin_rendering": { "pores": "hidden", "no_smoothing": false }
                    },
                    "scene_setup": {
                      "location_type": "magical forest or cozy room",
                      "specific_environment": "a place that reflects the story's theme",
                      "environment_elements": ["glowing plants", "soft shadows"]
                    },
                    "composition_layout": {
                      "frame_1": {
                        "type": "environmental candid",
                        "pose": "sitting or walking",
                        "action": "interacting with a magical element",
                        "camera_distance": "medium",
                        "camera_angle": "eye level",
                        "framing": "rule of thirds"
                      }
                    },
                    "interaction_logic": {
                      "subject_environment_relation": "harmonious",
                      "storytelling": "the character finds peace"
                    },
                    "lighting_setup": {
                      "lighting_type": "sunset or magical glow",
                      "light_character": "soft",
                      "light_source": "magical elements"
                    },
                    "camera_characteristics": {
                      "device": "cinema camera",
                      "lens_behavior": "standard",
                      "depth_of_field": "moderate"
                    }
                  }
                }
              `}
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const text = storyResponse.text || "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const storyData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      
      setVideoStatus("Génération de l'image magique...");

      // 3. Generate Image with Nano Banana 2
      const imageResponse = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{ text: `A magical, high-quality Pixar-style illustration for a children's story titled "${storyData.title}". The scene shows: ${storyData.situation}. Soft lighting, magical atmosphere, vibrant colors.` }],
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          }
        }
      });

      let base64Image = "";
      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
      
      const imageUrl = base64Image ? `data:image/png;base64,${base64Image}` : "";
      
      setVideoStatus("Animation de la vidéo (1-2 min)...");

      // 4. Generate Video with Veo (using the image as starting point)
      const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      let operation = await videoAi.models.generateVideos({
        model: VIDEO_MODEL,
        prompt: `Animate this scene softly: ${storyData.title}. Keep the magical and calm atmosphere.`,
        image: base64Image ? {
          imageBytes: base64Image,
          mimeType: 'image/png'
        } : undefined,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await videoAi.operations.getVideosOperation({ operation: operation });
      }

      const videoUrl = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      setVideoStatus("Enregistrement de la narration...");

      // 5. Generate TTS
      const ttsResponse = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: `Lis cette histoire avec une voix douce et bienveillante : ${storyData.content}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      setVideoStatus("Sauvegarde de l'histoire...");

      // 6. Save to Firestore
      const newStory = {
        userId: user.uid,
        title: storyData.title,
        content: storyData.content,
        emotion: storyData.emotion,
        situation: storyData.situation,
        imageUrl: videoUrl || imageUrl || "", 
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'stories'), newStory);
      
      const storyWithId = { id: docRef.id, ...newStory, createdAt: new Date(), audioData: audioData || "" } as Story;
      setCurrentStory(storyWithId);
      setView('story');
      setAudioBlob(null);

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("Votre clé API semble invalide ou a expiré. Veuillez la reconnecter dans les réglages.");
      } else if (err.message?.includes("safety")) {
        setError("Désolé, le contenu a été bloqué par les filtres de sécurité. Essaie de décrire la situation différemment.");
      } else {
        setError(`Désolé, une erreur est survenue (${err.message || "Inconnue"}). Veuillez réessayer.`);
      }
    } finally {
      setIsProcessing(false);
      setVideoStatus("");
    }
  };

  const deleteStory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'stories', id));
      if (currentStory?.id === id) {
        setCurrentStory(null);
        setView('home');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `stories/${id}`);
    }
  };

  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const playStoryAudio = async (story: Story) => {
    if (story.audioData) {
      const audio = new Audio(`data:audio/mp3;base64,${story.audioData}`);
      audio.play();
      return;
    }

    // Generate audio on demand if not present (to bypass Firestore 1MB limit)
    setIsGeneratingAudio(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const ttsResponse = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: `Lis cette histoire avec une voix douce et bienveillante : ${story.content}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        // Cache it in memory for this session
        story.audioData = audioData;
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        audio.play();
      }
    } catch (err) {
      console.error("Error generating audio:", err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playAudio = (base64: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audio.play();
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-serif selection:bg-[#5A5A40]/20">
      {/* --- Navigation --- */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-[#5A5A40]/10 z-50 px-6 py-4 flex justify-between items-center">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setView(user ? 'accueil' : 'landing')}
        >
          <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#5A5A40]">My kid story</h1>
        </div>

        {user ? (
          <div className="flex items-center gap-2 md:gap-6">
            <nav className="hidden md:flex items-center gap-4 bg-[#5A5A40]/5 p-1 rounded-full">
              <button 
                onClick={() => setView('accueil')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  view === 'accueil' ? "bg-[#5A5A40] text-white shadow-sm" : "text-[#5A5A40] hover:bg-[#5A5A40]/10"
                )}
              >
                <Mic2 className="w-4 h-4" /> Accueil
              </button>
              <button 
                onClick={() => setView('home')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  view === 'home' ? "bg-[#5A5A40] text-white shadow-sm" : "text-[#5A5A40] hover:bg-[#5A5A40]/10"
                )}
              >
                <HomeIcon className="w-4 h-4" /> Home
              </button>
              <button 
                onClick={() => setView('settings')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  view === 'settings' ? "bg-[#5A5A40] text-white shadow-sm" : "text-[#5A5A40] hover:bg-[#5A5A40]/10"
                )}
              >
                <SettingsIcon className="w-4 h-4" /> Settings
              </button>
            </nav>

            <div className="flex items-center gap-2">
              <button 
                onClick={logout}
                className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={login}
            className="bg-[#5A5A40] text-white px-6 py-2 rounded-full font-medium hover:bg-[#4A4A30] transition-all shadow-sm"
          >
            Se connecter
          </button>
        )}
      </nav>

      {/* Mobile Nav */}
      {user && (
        <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-[#5A5A40]/10 z-50 px-6 py-3 flex justify-around items-center">
          <button onClick={() => setView('accueil')} className={cn("flex flex-col items-center gap-1", view === 'accueil' ? "text-[#5A5A40]" : "text-[#5A5A40]/40")}>
            <Mic2 className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Accueil</span>
          </button>
          <button onClick={() => setView('home')} className={cn("flex flex-col items-center gap-1", view === 'home' ? "text-[#5A5A40]" : "text-[#5A5A40]/40")}>
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Home</span>
          </button>
          <button onClick={() => setView('settings')} className={cn("flex flex-col items-center gap-1", view === 'settings' ? "text-[#5A5A40]" : "text-[#5A5A40]/40")}>
            <SettingsIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Settings</span>
          </button>
        </nav>
      )}

      <main className="pt-24 pb-12 px-6 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'landing' ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-white rounded-3xl shadow-xl mx-auto mb-8 flex items-center justify-center">
                <Heart className="w-12 h-12 text-[#5A5A40] fill-[#5A5A40]/10" />
              </div>
              <h2 className="text-4xl font-bold mb-4 text-[#5A5A40]">Bienvenue sur My kid story</h2>
              <p className="text-lg text-[#5A5A40]/70 mb-8 max-w-md mx-auto">
                Transformez les émotions de la journée en histoires magiques pour aider votre enfant à grandir.
              </p>
              <button 
                onClick={login}
                className="bg-[#5A5A40] text-white px-8 py-4 rounded-full text-lg font-medium hover:scale-105 transition-transform shadow-lg flex items-center gap-3 mx-auto"
              >
                Commencer l'aventure <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          ) : view === 'accueil' ? (
            <motion.div 
              key="accueil"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {!hasApiKey && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl text-center space-y-4">
                  <h3 className="text-xl font-bold text-amber-800">Configuration Requise</h3>
                  <p className="text-amber-700">Pour générer des vidéos magiques avec Veo, vous devez connecter votre clé API Google Cloud (projet payant).</p>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-sm underline block">En savoir plus sur la facturation</a>
                  <button 
                    onClick={handleOpenKeySelector}
                    className="bg-amber-600 text-white px-6 py-2 rounded-full font-bold hover:bg-amber-700 transition-colors"
                  >
                    Connecter ma clé API
                  </button>
                </div>
              )}

              <header className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-[#5A5A40]">Comment s'est passée ta journée ?</h2>
                <p className="text-[#5A5A40]/70">Enregistre un petit message pour créer une histoire.</p>
              </header>

              <div className="flex flex-col items-center gap-8">
                <div className="relative">
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.2, opacity: 0.3 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="absolute inset-0 bg-red-500 rounded-full blur-2xl"
                      />
                    )}
                  </AnimatePresence>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing || !hasApiKey}
                    className={cn(
                      "relative w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-xl z-10",
                      !hasApiKey ? "bg-gray-200 text-gray-400 cursor-not-allowed" :
                      isRecording ? "bg-red-500 text-white" : "bg-white text-[#5A5A40] hover:scale-105"
                    )}
                  >
                    {isRecording ? <StopCircle className="w-16 h-16" /> : <Mic className="w-16 h-16" />}
                  </button>
                </div>

                {audioBlob && !isRecording && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setAudioBlob(null)}
                        className="p-3 rounded-full border border-[#5A5A40]/20 text-[#5A5A40]/60 hover:bg-white transition-colors"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={generateStory}
                        disabled={isProcessing}
                        className="bg-[#5A5A40] text-white px-8 py-4 rounded-full font-medium shadow-lg hover:bg-[#4A4A30] transition-colors flex items-center gap-3"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {videoStatus}
                          </>
                        ) : (
                          <>
                            Créer mon histoire vidéo <Sparkles className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {error && (
                <p className="text-red-500 text-center bg-red-50 p-4 rounded-2xl border border-red-100">
                  {error}
                </p>
              )}

              {stories.length > 0 && (
                <section className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#5A5A40]">Histoires récentes</h3>
                    <button onClick={() => setView('home')} className="text-[#5A5A40]/60 hover:text-[#5A5A40] flex items-center gap-1 text-sm">
                      Voir tout <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {stories.slice(0, 2).map((story) => (
                      <StoryCard 
                        key={story.id} 
                        story={story} 
                        onClick={() => {
                          setCurrentStory(story);
                          setView('story');
                        }}
                        onDelete={(e) => deleteStory(story.id, e)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          ) : view === 'home' ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-[#5A5A40]">Toutes tes histoires</h2>
                <button 
                  onClick={() => setView('accueil')}
                  className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="w-6 h-6 text-[#5A5A40]" />
                </button>
              </div>
              
              {stories.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-[#5A5A40]/10">
                  <BookOpen className="w-12 h-12 text-[#5A5A40]/20 mx-auto mb-4" />
                  <p className="text-[#5A5A40]/50">Tu n'as pas encore d'histoires. Enregistre un message !</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {stories.map((story) => (
                    <StoryCard 
                      key={story.id} 
                      story={story} 
                      onClick={() => {
                        setCurrentStory(story);
                        setView('story');
                      }}
                      onDelete={(e) => deleteStory(story.id, e)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : view === 'settings' ? (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-bold text-[#5A5A40]">Réglages</h2>
              
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#5A5A40]/10 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-[#5A5A40] flex items-center gap-2">
                    <Heart className="w-5 h-5" /> Profil de l'enfant
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#5A5A40]/60">Âge de l'enfant</label>
                      <select 
                        value={settings.childAge}
                        onChange={(e) => setSettings({...settings, childAge: e.target.value})}
                        className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-[#5A5A40]/20"
                      >
                        {[3,4,5,6,7,8,9,10,11,12].map(age => (
                          <option key={age} value={age}>{age} ans</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#5A5A40]/60">Langue des histoires</label>
                      <select 
                        value={settings.language}
                        onChange={(e) => setSettings({...settings, language: e.target.value})}
                        className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-[#5A5A40]/20"
                      >
                        <option>Français</option>
                        <option>English</option>
                        <option>Español</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-8 border-t border-[#5A5A40]/5">
                  <h3 className="text-lg font-bold text-[#5A5A40] flex items-center gap-2">
                    <Sparkles className="w-5 h-5" /> Expérience
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-2xl">
                    <div>
                      <p className="font-medium">Narration vocale automatique</p>
                      <p className="text-sm text-[#5A5A40]/60">L'IA lit l'histoire dès qu'elle est générée.</p>
                    </div>
                    <button 
                      onClick={() => setSettings({...settings, enableVoice: !settings.enableVoice})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        settings.enableVoice ? "bg-[#5A5A40]" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        settings.enableVoice ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-8 border-t border-[#5A5A40]/5">
                  <h3 className="text-lg font-bold text-[#5A5A40] flex items-center gap-2 text-red-600">
                    <LogOut className="w-5 h-5" /> Zone Parentale
                  </h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#5A5A40]/60">Code PIN Parental (Optionnel)</label>
                    <input 
                      type="password"
                      placeholder="Ex: 1234"
                      maxLength={4}
                      value={settings.parentalPin}
                      onChange={(e) => setSettings({...settings, parentalPin: e.target.value})}
                      className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-[#5A5A40]/20"
                    />
                    <p className="text-xs text-[#5A5A40]/40 italic">Ce code sera demandé pour accéder aux réglages ou supprimer des histoires.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'story' && currentStory ? (
            <motion.div 
              key="story-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-[#5A5A40]/5"
            >
              {currentStory.imageUrl && (
                <div className="aspect-video w-full overflow-hidden relative bg-black">
                  {currentStory.imageUrl.includes('veo') || currentStory.imageUrl.startsWith('blob:') ? (
                    <VideoPlayer url={currentStory.imageUrl} />
                  ) : (
                    <img 
                      src={currentStory.imageUrl} 
                      alt={currentStory.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  <div className="absolute bottom-6 left-8 right-8 flex justify-between items-end pointer-events-none">
                    <h2 className="text-3xl font-bold text-white drop-shadow-md">{currentStory.title}</h2>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        playStoryAudio(currentStory);
                      }}
                      disabled={isGeneratingAudio}
                      className={cn(
                        "w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform text-[#5A5A40] pointer-events-auto",
                        isGeneratingAudio && "opacity-50"
                      )}
                    >
                      {isGeneratingAudio ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : (
                        <Volume2 className="w-7 h-7" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="p-10 space-y-8">
                <div className="flex flex-wrap gap-3">
                  <span className="bg-[#5A5A40]/10 text-[#5A5A40] px-4 py-1 rounded-full text-sm font-medium">
                    Émotion : {currentStory.emotion}
                  </span>
                  <span className="bg-amber-50 text-amber-700 px-4 py-1 rounded-full text-sm font-medium">
                    {new Date(currentStory.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('fr-FR')}
                  </span>
                </div>

                <div className="prose prose-stone prose-lg max-w-none text-[#1A1A1A]/80 leading-relaxed italic">
                  <Markdown>{currentStory.content}</Markdown>
                </div>

                <div className="pt-8 border-top border-[#5A5A40]/10 flex justify-center">
                  <button 
                    onClick={() => setView('home')}
                    className="bg-[#5A5A40] text-white px-10 py-4 rounded-full font-medium hover:bg-[#4A4A30] transition-colors shadow-lg"
                  >
                    Prêt pour une nouvelle histoire ?
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}

function VideoPlayer({ url, className }: { url: string, className?: string }) {
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    
    // If it's already a blob or data URL, use it directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setVideoBlobUrl(url);
      return;
    }

    let currentBlobUrl: string | null = null;

    // Otherwise, fetch it using the API key
    const fetchVideo = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'x-goog-api-key': process.env.API_KEY! },
        });
        if (!response.ok) throw new Error('Failed to fetch video');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        currentBlobUrl = blobUrl;
        setVideoBlobUrl(blobUrl);
      } catch (err) {
        console.error('Error fetching video:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();

    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [url]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-black/10", className)}>
        <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (error || !videoBlobUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-black/10 text-[#5A5A40]/40", className)}>
        <VideoOff className="w-8 h-8" />
      </div>
    );
  }

  return (
    <video 
      src={videoBlobUrl} 
      controls 
      autoPlay 
      loop 
      className={cn("w-full h-full object-contain", className)}
    />
  );
}

function StoryCard({ story, onClick, onDelete }: { story: Story, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) {
  const isVideo = story.imageUrl && (story.imageUrl.includes('veo') || story.imageUrl.startsWith('blob:'));

  return (
    <motion.div 
      layout
      onClick={onClick}
      className="group bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all border border-[#5A5A40]/5 cursor-pointer relative overflow-hidden"
    >
      <div className="flex gap-4">
        {story.imageUrl && (
          <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-black/5 flex items-center justify-center">
            {isVideo ? (
              <div className="relative w-full h-full flex items-center justify-center bg-[#5A5A40]/5">
                <Video className="w-8 h-8 text-[#5A5A40]/20" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-[#5A5A40]" />
                </div>
              </div>
            ) : (
              <img 
                src={story.imageUrl} 
                alt={story.title} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-bold text-lg text-[#5A5A40] truncate">{story.title}</h4>
            <button 
              onClick={onDelete}
              className="p-1 text-red-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-[#5A5A40]/60 line-clamp-2 mb-3 italic">
            {story.situation}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]/40">
              {story.emotion}
            </span>
            <div className="flex items-center gap-1">
              {isVideo && <Video className="w-3 h-3 text-[#5A5A40]/40" />}
              <Play className="w-4 h-4 text-[#5A5A40] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
