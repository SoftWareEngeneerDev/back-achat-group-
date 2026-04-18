#!/usr/bin/env node
// ============================================================
// SCRIPT : Créer un administrateur
// Usage  : npm run create:admin
// ============================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcrypt');
const readline         = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

const ask = (question) => new Promise(resolve => rl.question(question, resolve));

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     Djula Market — Créer un Admin      ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    const name     = await ask('👤 Nom complet       : ');
    const phone    = await ask('📱 Téléphone (+226)  : ');
    const email    = await ask('📧 Email             : ');
    const password = await ask('🔑 Mot de passe      : ');

    if (!name || !phone || !password) {
      console.error('\n❌ Nom, téléphone et mot de passe sont obligatoires.');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('\n❌ Le mot de passe doit faire au moins 8 caractères.');
      process.exit(1);
    }

    // Formater le téléphone
    let formattedPhone = phone.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+226' + formattedPhone;
    }

    // Vérifier si l'utilisateur existe déjà
    const existing = await prisma.user.findUnique({
      where: { phone: formattedPhone }
    });

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
      console.log(`\n⚠️  Compte existant trouvé (rôle: ${existing.role}). Promotion en ADMIN...`);
      await prisma.user.update({
        where: { phone: formattedPhone },
        data:  { role: 'ADMIN', status: 'ACTIVE', passwordHash }
      });
      console.log(`\n✅ ${existing.name} promu ADMIN avec succès !`);
    } else {
      const admin = await prisma.user.create({
        data: {
          name:         name,
          phone:        formattedPhone,
          email:        email || null,
          passwordHash,
          role:         'ADMIN',
          status:       'ACTIVE',
          city:         'Ouagadougou',
          trustScore:   100,
          referralCode: 'ADMIN' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        }
      });

      console.log('\n╔════════════════════════════════════════╗');
      console.log('║      ✅ Admin créé avec succès !        ║');
      console.log('╚════════════════════════════════════════╝');
      console.log(`\n  ID       : ${admin.id}`);
      console.log(`  Nom      : ${admin.name}`);
      console.log(`  Téléphone: ${admin.phone}`);
      console.log(`  Rôle     : ${admin.role}`);
    }

    console.log('\n  👉 Connectez-vous sur http://localhost:4200/auth/login');
    console.log(`  👉 Téléphone : ${formattedPhone}`);
    console.log(`  👉 Mot de passe : ${password}\n`);

  } catch (err) {
    console.error('\n❌ Erreur :', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();