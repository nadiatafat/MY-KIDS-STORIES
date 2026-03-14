import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { StoryResponse } from "../types";

const SYSTEM_INSTRUCTION = `
# ROLE
Tu es le moteur de création de "My Kids Story". Ta mission est de transformer une émotion d'enfant en une mini-aventure thérapeutique sous forme de dessin animé.

# INPUT
L'utilisateur te donne une situation vécue (ex: "J'ai perdu mon doudou", "Un ami a été méchant").

# OBJECTIF DE SORTIE (JSON UNIQUEMENT)
Génère une réponse structurée pour piloter automatiquement les APIs suivantes :
1. TEXTE : Une histoire courte (100 mots) positive et rassurante.
2. IMAGE (Nano Banana) : Un prompt visuel artistique.
3. VIDÉO (Veo) : Une instruction de mouvement.

# STYLE VISUEL (NANO BANANA)
Le prompt image doit TOUJOURS suivre ce style : "3D Disney Pixar style, cinematic lighting, cute expressive character, soft textures, bright colors, 8k resolution".

# STRUCTURE DE RÉPONSE OBLIGATOIRE (JSON)
Tu dois répondre uniquement avec ce format :
{
  "titre": "Le titre magique",
  "emotion": "L'émotion identifiée",
  "histoire": "Le récit pour l'enfant",
  "nano_banana_prompt": "Description visuelle détaillée style Pixar de la scène principale",
  "veo_motion": "Description du mouvement (ex: le personnage saute de joie, les étoiles scintillent)"
}
`;

export async function generateStory(input: string): Promise<StoryResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: input,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titre: { type: Type.STRING },
          emotion: { type: Type.STRING },
          histoire: { type: Type.STRING },
          nano_banana_prompt: { type: Type.STRING },
          veo_motion: { type: Type.STRING },
        },
        required: ["titre", "emotion", "histoire", "nano_banana_prompt", "veo_motion"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateImage(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K"
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
}

export async function generateVideo(prompt: string, imageBase64: string): Promise<string> {
  // Veo requires the selected API key
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY!;
  const ai = new GoogleGenAI({ apiKey });

  // Strip data:image/png;base64, prefix
  const base64Data = imageBase64.split(',')[1];

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    image: {
      imageBytes: base64Data,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("No video generated");

  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
