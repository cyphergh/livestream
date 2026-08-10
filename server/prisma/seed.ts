import { PrismaClient, Prisma } from '@prisma/client';

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

  // No channels are created by default. Admins create TV/radio stations from
  // the dashboard (name, logo, and for TV: free-to-air or subscription).

  // Landing-page content defaults (editable later from the admin CMS).
  const defaults: Record<string, unknown> = {
    'site.name': 'Rhema Life Church',
    'hero.title': 'A place to belong, believe and become.',
    'hero.tagline':
      'Anchored in faith, alive in community. Join us live online or in person — you have a seat at our table.',
    'about.heading': 'Our mission',
    'about.body':
      'We exist to help people find and follow Jesus. Through heartfelt worship, the Word, and genuine connection, we walk together — no matter where you are on your journey.',
    'announcement': 'Join us this Sunday at 9:00 AM — everyone is welcome, no exceptions.',
    'services': [
      { day: 'Sunday', time: '9:00 AM', name: 'Morning Celebration' },
      { day: 'Sunday', time: '11:30 AM', name: 'Contemporary Service' },
      { day: 'Wednesday', time: '7:00 PM', name: 'Midweek Refresh' },
    ],
    'footer.text': 'Walking in faith, gathering in love.',
  };
  for (const [key, value] of Object.entries(defaults)) {
    const exists = await prisma.setting.findUnique({ where: { key } });
    if (!exists) await prisma.setting.create({ data: { key, value: value as Prisma.InputJsonValue } });
  }

  console.log('Seed complete ✔');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
