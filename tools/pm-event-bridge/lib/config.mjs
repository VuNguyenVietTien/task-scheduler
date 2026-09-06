import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULTS = Object.freeze({
  watchPrefix: 'pm-',
  dryRun: true,
  codexBin: 'codex',
  codexPrefixArgs: [],
  extraArgs: [],
  maxAttempts: 3,
  retryBaseMs: 1_000,
  retryMaxMs: 30_000,
  reconnectBaseMs: 1_000,
  reconnectMaxMs: 30_000,
  maxBatchEvents: 100,
  requestTimeoutMs: 10_000,
  wakeTimeoutMs: 600_000,
  killGraceMs: 5_000,
  reportDirectory: '',
  defaultDeadline: '',
});

function requireString(config, key) {
  if (typeof config[key] !== 'string' || !config[key].trim()) {
    throw new Error(`Config field ${key} must be a non-empty string`);
  }
}

function requireNumber(config, key, minimum = 0) {
  if (!Number.isFinite(config[key]) || config[key] < minimum) {
    throw new Error(`Config field ${key} must be a number >= ${minimum}`);
  }
}

export async function loadConfig(configPath) {
  const resolved = path.resolve(configPath);
  const raw = JSON.parse(await readFile(resolved, 'utf8'));
  const config = { ...DEFAULTS, ...raw };
  requireString(config, 'herdrSocket');
  requireString(config, 'queueDir');
  requireString(config, 'managerThreadId');
  requireString(config, 'codexBin');
  if (!Array.isArray(config.codexPrefixArgs) || !config.codexPrefixArgs.every((item) => typeof item === 'string')) {
    throw new Error('Config field codexPrefixArgs must be an array of strings');
  }
  if (!Array.isArray(config.extraArgs) || !config.extraArgs.every((item) => typeof item === 'string')) {
    throw new Error('Config field extraArgs must be an array of strings');
  }
  for (const [key, minimum] of [
    ['maxAttempts', 1],
    ['retryBaseMs', 0],
    ['retryMaxMs', 0],
    ['reconnectBaseMs', 0],
    ['reconnectMaxMs', 0],
    ['maxBatchEvents', 1],
    ['requestTimeoutMs', 1],
    ['wakeTimeoutMs', 0],
    ['killGraceMs', 0],
  ]) requireNumber(config, key, minimum);
  if (typeof config.dryRun !== 'boolean') throw new Error('Config field dryRun must be boolean');
  config.queueDir = path.resolve(config.queueDir);
  return config;
}

export { DEFAULTS };
