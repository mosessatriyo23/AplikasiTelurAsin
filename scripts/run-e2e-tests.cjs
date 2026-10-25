const { mkdtempSync, mkdirSync, cpSync, symlinkSync, rmSync } = require('node:fs');
const { join, resolve, relative, sep } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '..');
// Keep the staged app on the dependency drive: Next webpack cannot resolve
// cross-drive Windows junction paths. This private directory contains no .env.
const base = join(root, '.e2e-workspaces');
mkdirSync(base, { recursive: true });
const temp = mkdtempSync(join(base, 'telur-e2e-'));
const database = join(temp, 'isolated.db');
// Stage only source files, never .env files or project databases. Next therefore
// cannot load real credentials even when it automatically searches for .env.
const env = {};
for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'HOME', 'CI', 'PLAYWRIGHT_BROWSERS_PATH']) {
  if (process.env[key] !== undefined) env[key] = process.env[key];
}
Object.assign(env, { DATABASE_URL: `file:${database}`, E2E_TEMP_DB: database, E2E_ISOLATED: 'true', NEXT_TELEMETRY_DISABLED: '1', ADMIN_SESSION_SECRET: 'isolated-e2e-secret-not-for-production-123456', APP_URL: 'http://127.0.0.1:3101', MIDTRANS_IS_PRODUCTION: 'false', MIDTRANS_SERVER_KEY: '', NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: '' });
try {
  if (!relative(temp, database) || relative(temp, database).startsWith('..') || database === resolve(root, 'prisma', 'dev.db') || !database.startsWith(temp + sep)) throw Error('Refusing non-isolated database');
  for (const name of ['app', 'components', 'lib', 'public', 'tests/e2e', 'next.config.ts', 'tsconfig.json', 'next-env.d.ts', 'package.json', 'playwright.config.ts']) cpSync(join(root, name), join(temp, name), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(temp, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // All browser API requests are mocked. No schema initialization or seed is needed.
  const result = spawnSync(process.execPath, [join(root, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', ...process.argv.slice(2)], { cwd: temp, env, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
  if (result.error) console.error(result.error);
} finally {
  try { rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); }
  catch (error) { console.error('Could not remove temporary E2E workspace:', error.message); }
}
