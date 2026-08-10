// Church branding + fallback landing content. The admin CMS can override any
// of this (server settings page); values here only apply until an admin saves
// their own copy (see src/stores/contentStore.ts).

export const CHURCH = {
  name: "Knights Of Marshall",
  tagline: "Unity, Charity, Fraternity, and Service",
  url: "/",
};

export interface ServiceTime {
  day: string;
  time: string;
  name: string;
}

export interface SiteContent {
  "site.name": string;
  "hero.title": string;
  "hero.tagline": string;
  "hero.secondary"?: string;
  "about.heading"?: string;
  "about.body"?: string;
  "about.imageUrl"?: string;
  announcement?: string;
  services: ServiceTime[];
  "footer.text"?: string;
  "contact.heading"?: string;
  "contact.body"?: string;
  "contact.email"?: string;
  "contact.phone"?: string;
  "contact.address"?: string;
  "contact.hours"?: string;
  "contact.mapUrl"?: string;
}

export const DEFAULT_CONTENT: SiteContent = {
  "site.name": CHURCH.name,
  "hero.title": "e Unity, Charity, Fraternity, and Service",
  "hero.tagline":
    "Anchored in faith, alive in community. Join us live online or in person — you have a seat at our table.",
  "about.heading": "Our mission",
  "about.body":
    "We exist to help people find and follow Jesus. Through heartfelt worship, the Word, and genuine connection, we walk together — no matter where you are on your journey.",
  announcement:
    "Join us this Sunday at 9:00 AM — everyone is welcome, no exceptions.",
  services: [
    { day: "Sunday", time: "9:00 AM", name: "Morning Celebration" },
    { day: "Sunday", time: "11:30 AM", name: "Contemporary Service" },
    { day: "Wednesday", time: "7:00 PM", name: "Midweek Refresh" },
  ],
  "footer.text": "Walking in faith, gathering in love.",
  "contact.heading": "Contact us & find us",
  "contact.body":
    "Questions, prayer requests, or just want to say hello? Reach out any time — we'd love to hear from you.",
  "contact.email": "hello@knightsofmarshall.org",
  "contact.phone": "(555) 012-3456",
  "contact.address": "123 Assembly Avenue, Marshall, MI 49068",
  "contact.hours": "Office hours: Tuesday–Friday, 9 AM – 4 PM",
  "contact.mapUrl": "",
};
