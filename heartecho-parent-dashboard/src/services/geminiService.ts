import { GoogleGenAI, Type } from "@google/genai";
import { Session } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateWeeklyInsight(sessions: Session[], childName: string) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "A gentle 2-sentence summary of the child's emotional week." },
          conversationStarter: { type: Type.STRING, description: "A gentle question for the parent to ask the child." },
          theme: { type: Type.STRING, description: "The dominant narrative theme of the week." }
        },
        required: ["summary", "conversationStarter", "theme"]
      }
    },
    contents: `Analyze these recent story sessions for ${childName}:
    ${JSON.stringify(sessions.map(s => ({ emotion: s.emotion, topic: s.topic, character: s.character })))}
    
    Provide a gentle, emotionally intelligent insight for the parent. Avoid clinical language. Focus on growth and narrative.`
  });

  const response = await model;
  return JSON.parse(response.text || "{}");
}
