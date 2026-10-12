import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const source = fileURLToPath(new URL('../', import.meta.url))
process.chdir(source)
const env = {
  ...(existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {}),
  ...process.env,
}
const dev = process.argv.includes('--dev')
const demo = process.argv.includes('--demo')
if (demo && !dev)
  throw new Error('Demo is uitsluitend toegestaan bij ontwikkeling.')
const port = Number(dev ? 5173 : env.APP_PORT || 8000)
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('APP_PORT moet tussen 1 en 65535 liggen.')
const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((x) => x && x.family === 'IPv4' && !x.internal)
  .map((x) => x.address)
const urls = ['127.0.0.1', ...addresses].map((host) => `http://${host}:${port}`)
env.BREAKOUT_ALLOWED_ORIGINS = [
  ...new Set([
    ...(env.BREAKOUT_ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    ...urls,
  ]),
].join(',')
const python =
  env.BREAKOUT_PYTHON_BIN ||
  path.join(
    source,
    'backend',
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  )
if (!existsSync(python))
  throw new Error(
    'Installeer eerst Python 3.12+ en de backend-venv; zie backend/README.md.',
  )
if (!dev) {
  const built = spawnSync(
    process.execPath,
    [process.env.npm_execpath, 'run', 'build'],
    { cwd: source, env, stdio: 'inherit' },
  )
  if (built.status !== 0) process.exit(built.status || 1)
}
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
function start(executable, args, childEnv = env) {
  const child = spawn(executable, args, {
    cwd: source,
    env: childEnv,
    stdio: 'inherit',
  })
  children.push(child)
  child.on('error', (error) => {
    console.error('Starten mislukt:', error.message)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0)
  })
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
start(process.execPath, ['server/ibkr-api.mjs'], {
  ...env,
  IBKR_API_HOST: '127.0.0.1',
  IBKR_API_PORT: '8787',
  IBKR_CLIENT_ID: env.PORTFOLIO_IBKR_CLIENT_ID || '77',
  IBKR_PORT: env.PORTFOLIO_IBKR_PORT || '4001',
  IBKR_ALLOWED_ORIGINS: env.BREAKOUT_ALLOWED_ORIGINS,
  IBKR_SNAPSHOT_PATH:
    env.IBKR_SNAPSHOT_PATH ||
    path.join(source, 'data/private/live-snapshot.json'),
})
start(python, [
  '-m',
  'uvicorn',
  demo ? 'tests.smoke_server:app' : 'app.main:app',
  '--app-dir',
  'backend',
  '--host',
  dev ? '127.0.0.1' : env.APP_HOST || '0.0.0.0',
  '--port',
  String(dev ? 8788 : port),
])
if (dev)
  start(process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--host',
    '0.0.0.0',
    '--port',
    String(port),
    '--strictPort',
  ])
console.log('\nBreakout · Read-only — geen orderuitvoering')
if (demo)
  console.log(
    'DEMO — fictieve testdata, geen echte IBKR-marktdata. Tijdelijke database.',
  )
console.log('Alleen lokaal/LAN gebruiken; geen router-portforwarding.')
for (const url of urls) console.log(`LAN: ${url}/#breakout`)
