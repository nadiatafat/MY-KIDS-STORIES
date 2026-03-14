export interface StoryResponse {
  titre: string;
  emotion: string;
  histoire: string;
  nano_banana_prompt: string;
  veo_motion: string;
}

export type AppState = 'idle' | 'generating_story' | 'generating_image' | 'generating_video' | 'ready';
