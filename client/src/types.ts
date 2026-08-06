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
export type AccessType = 'FREE' | 'SUBSCRIPTION';

export interface Channel {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  type: ChannelType;
  visibility: Visibility;
  accessType: AccessType;
  logoUrl?: string | null;
  coverUrl?: string | null;
  live: boolean;
  hls?: string | null;
  whep?: string | null;
  programs?: Program[];
  overlay?: Overlay | null;
}

export type OverlayMode = 'off' | 'ticker' | 'image' | 'text';
export type OverlayPosition =
  | 'bottom'
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface Overlay {
  mode: OverlayMode;
  logoVisible: boolean;
  text: string;
  position: OverlayPosition;
  fontSize: number;
  color: string;
  bgColor: string;
  speed: number;
  opacity: number;
  imageUrl: string | null;
  width: number | null;
  height: number | null;
  borderRadius: number;
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
