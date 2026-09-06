#!/usr/bin/env node
import { DurableQueue } from './lib/durable-queue.mjs';
import { loadConfig } from './lib/config.mjs';
import { EventBridge } from './lib/event-bridge.mjs';

const USAGE = `Usage:
  node pm-event-bridge.mjs status --config /absolute/path/config.json
  node pm-event-bridge.mjs run --config /absolute/path/config.json [--dry-run] [--enable-live-wake]

run stays in the foreground until SIGINT/SIGTERM. It installs no daemon or launchd job.
A config value dryRun:true is the default. A real wake additionally requires both
config dryRun:false and the explicit --enable-live-wake command flag.`;

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--config') options.configPath = rest[++index];
    else if (value === '--dry-run') options.forceDryRun = true;
    else if (value === '--enable-live-wake') options.enableLiveWake = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function logger(event, details) {
  process.stderr.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...details })}\n`);
}

async function run(options) {
  if (!options.configPath) throw new Error('--config is required');
  const config = await loadConfig(options.configPath);
  // Two independent opt-ins prevent an ordinary CLI invocation from resuming a
  // Desktop/manager thread if a copied config was changed unintentionally.
  config.dryRun = options.forceDryRun || !(config.dryRun === false && options.enableLiveWake);

  const bridge = new EventBridge(config, { logger });
  let signal;
  const untilSignal = new Promise((resolve) => { signal = resolve; });
  const shutdown = () => signal();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await bridge.start();
  process.stdout.write(`${JSON.stringify({
    status: 'connected',
    dryRun: config.dryRun,
    queueDir: config.queueDir,
    message: 'Foreground bridge only; no launchd service was installed.',
  })}\n`);
  await untilSignal;
  await bridge.stop();
}

async function status(options) {
  if (!options.configPath) throw new Error('--config is required');
  const config = await loadConfig(options.configPath);
  const queue = new DurableQueue(config.queueDir);
  await queue.init();
  process.stdout.write(`${JSON.stringify({
    dryRun: config.dryRun !== false,
    queue: await queue.status(),
  }, null, 2)}\n`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help || !options.command || options.command === 'help') {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (options.command === 'status') return status(options);
  if (options.command === 'run') return run(options);
  throw new Error(`Unknown command: ${options.command}`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n${USAGE}\n`);
  process.exitCode = 1;
});
