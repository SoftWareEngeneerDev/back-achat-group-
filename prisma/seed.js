const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin
  const adminHash = await bcrypt.hash('Admin@2024!', 12);
  const admin = await prisma.user.upsert({
    where: { phone: '+22600000001' },
    update: {},
    create: {
      phone: '+22600000001',
      email: 'admin@votreplateforme.bf',
      name: 'Super Admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      referralCode: 'ADMIN001',
    },
  });
  console.log('✅ Admin créé:', admin.email);

  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'electronique' }, update: {}, create: { name: 'Électronique', slug: 'electronique' } }),
    prisma.category.upsert({ where: { slug: 'alimentaire' }, update: {}, create: { name: 'Alimentaire', slug: 'alimentaire' } }),
    prisma.category.upsert({ where: { slug: 'textile' }, update: {}, create: { name: 'Textile & Mode', slug: 'textile' } }),
    prisma.category.upsert({ where: { slug: 'maison' }, update: {}, create: { name: 'Maison & Jardin', slug: 'maison' } }),
    prisma.category.upsert({ where: { slug: 'sante' }, update: {}, create: { name: 'Santé & Beauté', slug: 'sante' } }),
  ]);
  console.log('✅ Catégories créées:', categories.length);

  // Fournisseur test
  const supplierHash = await bcrypt.hash('Supplier@2024!', 12);
  const supplierUser = await prisma.user.upsert({
    where: { phone: '+22600000002' },
    update: {},
    create: {
      phone: '+22600000002',
      email: 'fournisseur@test.bf',
      name: 'Fournisseur Test',
      passwordHash: supplierHash,
      role: 'SUPPLIER',
      status: 'ACTIVE',
      referralCode: 'SUPP001',
    },
  });

  await prisma.supplier.upsert({
    where: { userId: supplierUser.id },
    update: {},
    create: {
      userId: supplierUser.id,
      companyName: 'Tech Ouaga SARL',
      siret: 'BF123456789',
      status: 'APPROVED',
      validatedAt: new Date(),
      validatedBy: admin.id,
    },
  });
  console.log('✅ Fournisseur créé:', supplierUser.email);

  // Membre test
  const memberHash = await bcrypt.hash('Member@2024!', 12);
  await prisma.user.upsert({
    where: { phone: '+22670000001' },
    update: {},
    create: {
      phone: '+22670000001',
      email: 'membre@test.bf',
      name: 'Kofi Traoré',
      passwordHash: memberHash,
      role: 'MEMBER',
      status: 'ACTIVE',
      city: 'Ouagadougou',
      referralCode: 'MEMB001',
    },
  });
  console.log('✅ Membre test créé');

  console.log('🎉 Seed terminé !');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
