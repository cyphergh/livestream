import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/lib/slug';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@livestream.local';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        password: await Bun.password.hash('admin12345'),
        role: 'ADMIN',
      },
    });
    console.log('Created admin user', adminEmail);
  }

  const samples: { name: string; type: 'RADIO' | 'TV'; description: string }[] = [
    { name: 'Vibe FM', type: 'RADIO', description: 'Hits & charts 24/7' },
    { name: 'News 24', type: 'TV', description: 'Live news channel' },
    { name: 'Sports One', type: 'TV', description: 'Sports highlights & live games' },
  ];

  for (const s of samples) {
    const slug = slugify(s.name);
    const existing = await prisma.channel.findUnique({ where: { slug } });
    if (existing) continue;
    const channel = await prisma.channel.create({
      data: {
        slug,
        name: s.name,
        description: s.description,
        type: s.type,
        ownerId: admin.id,
      },
    });
    await prisma.ingestKey.create({
      data: {
        channelId: channel.id,
        name: 'Primary RTMP',
        protocol: 'rtmp',
        password: crypto.randomUUID().replaceAll('-', '').slice(0, 24),
      },
    });
    console.log('Seeded channel', s.name);
  }

  console.log('Seed complete ✔');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
