import { PrismaClient } from '@prisma/client';

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

  console.log('Seed complete ✔');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
