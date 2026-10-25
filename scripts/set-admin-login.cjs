const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  let db;
  try {
    let credentials;
    try { credentials = JSON.parse(input.replace(/^\uFEFF/, '')); }
    catch { throw Error('Input JSON tidak valid.'); }
    const { username, password } = credentials || {};
    if (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/.test(username)) throw Error('Username harus sudah lowercase, 3–40 karakter: huruf a-z, angka, titik, minus, atau garis bawah; tanpa spasi.');
    const normalized = username;
    if (typeof password !== 'string' || password.length < 12) throw Error('Gunakan frasa kata sandi minimal 12 karakter, terutama selama tunnel publik aktif.');
    db = new PrismaClient();
    const admins = await db.admin.findMany({ orderBy: { createdAt: 'asc' } });
    if (admins.length !== 1) throw Error('Pengaturan ini hanya untuk database dengan tepat satu admin. Tidak ada akun yang diubah.');
    await db.admin.update({ where: { id: admins[0].id }, data: { username: normalized, passwordHash: await hash(password, 12) } });
    console.log('Username dan kata sandi berhasil diubah. Akun lama diperbarui, bukan dibuat ulang.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { if (db) await db.$disconnect(); }
});
