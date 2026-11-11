import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
await import('./build-electron.mjs');
const server = await createServer();
await server.listen();
const child = spawn(electron, [fileURLToPath(new URL('../dist-electron/main.cjs', import.meta.url))], { stdio: 'inherit', env: { ...process.env, AURORA_DEV_URL: 'http://127.0.0.1:5173' } });
let stopping = false;
async function stop(code = 0) { if (stopping) return; stopping = true; child.kill(); await server.close(); process.exit(code); }
child.on('exit', code => { void stop(code ?? 1); });
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
