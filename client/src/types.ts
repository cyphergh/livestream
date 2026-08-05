export type Role = 'ADMIN' | 'PRODUCER' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}

export type ChannelType = 'RADIO' | 'TV';
export type Visibility = 'PUBLIC' | 'PRIVATE';

export interface Channel {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  type: ChannelType;
  visibility: Visibility;
  logoUrl?: string | null;
  coverUrl?: string | null;
  live: boolean;
  hls?: string | null;
  whep?: string | null;
  programs?: Program[];
}

export interface Program {
  id: string;
  title: string;
  description?: string | null;
  genre?: string | null;
  startsAt: string;
  endsAt: string;
}

export interface IngestKey {
  id: string;
  channelId: string;
  name: string;
  protocol: 'rtmp' | 'rtsp' | 'srt' | 'whep';
  password: string;
  enabled: boolean;
}

export interface RestreamTarget {
  id: string;
  channelId: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface PullSource {
  id: string;
  channelId: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface Session {
  id: string;
  channelId: string;
  startedAt: string;
  endedAt?: string | null;
  title?: string | null;
  isLive: boolean;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  userName?: string;
  body: string;
  createdAt: string;
}
