const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, relative } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '..');
const original = resolve(root, 'prisma', 'dev.db');
const temp = mkdtempSync(join(tmpdir(), 'telur-integration-'));
const file = resolve(temp, 'integration.db');
function assertIsolated() {
  if (file === original || !file.startsWith(temp + require('node:path').sep) || relative(root, file).startsWith('prisma')) throw Error('Refusing original project database');
  if (process.env.TEST_DATABASE_FILE && resolve(process.env.TEST_DATABASE_FILE) === original) throw Error('Refusing original project database');
}
const env = { ...process.env, DATABASE_URL: `file:${file}`, TEST_DATABASE_FILE: file, NODE_ENV: 'test', ALLOW_TEMP_TEST_DB: 'true' };
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) throw result.error || Error(`${command} exited ${result.status}`);
}
try {
  assertIsolated();
  run('npx', ['prisma', 'migrate', 'deploy']); // isolated temp file only
  run('npx', ['prisma', 'migrate', 'deploy']); // deploy must be repeatable
  run('npx', ['tsx', '--test', 'tests/integration/*.test.ts']);
} catch (error) { console.error('Isolated integration test failed:', error.message); process.exitCode = 1; }
finally { rmSync(temp, { recursive: true, force: true }); }
