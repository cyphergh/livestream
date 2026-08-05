# LiveStream — Live Radio & TV streaming platform

Backend: **Bun + Elysia + Prisma + PostgreSQL** · Media server: **MediaMTX** (sidecar)
Frontend: **React + Zustand + Tailwind CSS + Vite**

Two portals:
- **Guest** — browse/watch live radio & TV channels, EPG, chat.
- **Admin** — live studio (WebRTC/WHIP), ingest keys (RTMP/SRT), pull sources, restream targets, schedule.

## Quick start

```bash
cp .env.example .env            # adjust secrets
docker compose up -d            # Postgres + MediaMTX
cd server && bun install && bun run db:migrate && bun run dev
cd client && bun install && bun run dev
```

- Client: http://localhost:5173
- API: http://localhost:3000
- MediaMTX: http://localhost:9997 (API), HLS on 8888, WebRTC on 8889

## Docs
See `docs/` for architecture, ingest, restream, and deployment (HTTPS/TURN) notes.
