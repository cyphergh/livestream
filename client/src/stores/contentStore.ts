import { create } from 'zustand';
import { http } from '../lib/api';
import { DEFAULT_CONTENT, type SiteContent } from '../config';
import type { MediaAsset, SiteContentResult } from '../types';

// Site-wide content for the guest landing page: editable settings merged over
// client defaults (so the page works even with an empty DB) plus the published
// media library (sermon videos + gallery images).

interface ContentState {
  content: SiteContent;
  media: MediaAsset[];
  loaded: boolean;
  load: () => Promise<void>;
}

const mergeContent = (settings: Record<string, unknown>): SiteContent => {
  const services = Array.isArray(settings.services) ? (settings.services as SiteContent['services']) : DEFAULT_CONTENT.services;
  const s = settings ?? {};
  return {
    ...DEFAULT_CONTENT,
    ...(typeof s['site.name'] === 'string' ? { 'site.name': s['site.name'] } : {}),
    ...(typeof s['hero.title'] === 'string' ? { 'hero.title': s['hero.title'] } : {}),
    ...(typeof s['hero.tagline'] === 'string' ? { 'hero.tagline': s['hero.tagline'] } : {}),
    ...(typeof s['hero.secondary'] === 'string' ? { 'hero.secondary': s['hero.secondary'] } : {}),
    ...(typeof s['about.heading'] === 'string' ? { 'about.heading': s['about.heading'] } : {}),
    ...(typeof s['about.body'] === 'string' ? { 'about.body': s['about.body'] } : {}),
    ...(typeof s['about.imageUrl'] === 'string' ? { 'about.imageUrl': s['about.imageUrl'] } : {}),
    ...(typeof s['announcement'] === 'string' ? { 'announcement': s['announcement'] } : {}),
    services,
    ...(typeof s['footer.text'] === 'string' ? { 'footer.text': s['footer.text'] } : {}),
    ...(typeof s['contact.heading'] === 'string' ? { 'contact.heading': s['contact.heading'] } : {}),
    ...(typeof s['contact.body'] === 'string' ? { 'contact.body': s['contact.body'] } : {}),
    ...(typeof s['contact.email'] === 'string' ? { 'contact.email': s['contact.email'] } : {}),
    ...(typeof s['contact.phone'] === 'string' ? { 'contact.phone': s['contact.phone'] } : {}),
    ...(typeof s['contact.address'] === 'string' ? { 'contact.address': s['contact.address'] } : {}),
    ...(typeof s['contact.hours'] === 'string' ? { 'contact.hours': s['contact.hours'] } : {}),
    ...(typeof s['contact.mapUrl'] === 'string' ? { 'contact.mapUrl': s['contact.mapUrl'] } : {}),
  };
};

export const useContentStore = create<ContentState>((set) => ({
  content: DEFAULT_CONTENT,
  media: [],
  loaded: false,
  async load() {
    try {
      const [data, media] = await Promise.all([
        http.get<SiteContentResult>('/content'),
        http.get<{ items: MediaAsset[] }>('/media'),
      ]);
      set({
        content: mergeContent(data.settings),
        media: media.items,
        loaded: true,
      });
    } catch {
      // Offline/error: keep defaults so the landing still renders.
      set({ loaded: true });
    }
  },
}));