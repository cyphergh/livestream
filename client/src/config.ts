// Church branding + fallback landing content. The admin CMS can override any
// of this (server settings page); values here only apply until an admin saves
// their own copy (see src/stores/contentStore.ts).

export const CHURCH = {
  name: 'Rhema Life Church',
  tagline: 'Real people · Real community · Real encounters',
  url: '/',
};

export interface ServiceTime {
  day: string;
  time: string;
  name: string;
}

export interface SiteContent {
  'site.name': string;
  'hero.title': string;
  'hero.tagline': string;
  'hero.secondary'?: string;
  'about.heading'?: string;
  'about.body'?: string;
  'about.imageUrl'?: string;
  'announcement'?: string;
  services: ServiceTime[];
  'footer.text'?: string;
}

export const DEFAULT_CONTENT: SiteContent = {
  'site.name': CHURCH.name,
  'hero.title': 'A place to belong, believe and become.',
  'hero.tagline':
    'Anchored in faith, alive in community. Join us live online or in person — you have a seat at our table.',
  'about.heading': 'Our mission',
  'about.body':
    'We exist to help people find and follow Jesus. Through heartfelt worship, the Word, and genuine connection, we walk together — no matter where you are on your journey.',
  'announcement': 'Join us this Sunday at 9:00 AM — everyone is welcome, no exceptions.',
  services: [
    { day: 'Sunday', time: '9:00 AM', name: 'Morning Celebration' },
    { day: 'Sunday', time: '11:30 AM', name: 'Contemporary Service' },
    { day: 'Wednesday', time: '7:00 PM', name: 'Midweek Refresh' },
  ],
  'footer.text': 'Walking in faith, gathering in love.',
};