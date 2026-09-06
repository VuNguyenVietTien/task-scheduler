import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
}

export async function appendJsonl(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const handle = await open(filePath, 'a', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function readJsonl(filePath) {
  let text;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const values = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch (error) {
      // Torn tails must be repaired by repairJsonl before this reader runs;
      // anything malformed after repair is real corruption and must fail loud.
      throw new Error(`Invalid JSONL record in ${filePath} at line ${index + 1}: ${error.message}`);
    }
    values.push(value);
  }
  return values;
}

// F2: a crash can leave a final record partially appended (no trailing
// newline, unparsable). Durably quarantine those bytes and truncate the file
// back to the last acknowledged record boundary before any new append; a
// complete-but-unterminated final record gets a separator appended instead.
export async function repairJsonl(filePath) {
  let buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return { repaired: false };
    throw error;
  }

  const lastNewline = buffer.lastIndexOf(0x0a);
  const tail = buffer.subarray(lastNewline + 1);
  if (tail.length === 0) return { repaired: false };

  const tailText = tail.toString('utf8').trim();
  let parses = false;
  if (tailText) {
    try {
      JSON.parse(tailText);
      parses = true;
    } catch {
      parses = false;
    }
  }

  const truncationOffset = lastNewline + 1;
  if (parses) {
    // Complete record, just missing its separator: add it so replay appends
    // a fresh line instead of gluing onto this one.
    const handle = await open(filePath, 'a');
    try {
      await handle.writeFile('\n', 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    return { repaired: true, mode: 'separator' };
  }

  // Torn bytes: quarantine them durably, then truncate.
  const quarantine = `${filePath}.torn-${Date.now()}`;
  const qHandle = await open(quarantine, 'wx', 0o600);
  try {
    await qHandle.writeFile(tail);
    await qHandle.sync();
  } finally {
    await qHandle.close();
  }

  const handle = await open(filePath, 'r+');
  try {
    await handle.truncate(truncationOffset);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { repaired: true, mode: 'truncate', quarantinedBytes: tail.length, quarantine };
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export async function writeJsonAtomic(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, filePath);

    // Syncing the parent makes the rename durable on filesystems that support it.
    // Some platforms reject directory handles; the file itself has already been fsynced.
    try {
      const directory = await open(path.dirname(filePath), 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch (error) {
      if (!['EINVAL', 'EPERM', 'EISDIR'].includes(error.code)) throw error;
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function boundedBackoff(baseMilliseconds, maximumMilliseconds, attempt) {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(maximumMilliseconds, baseMilliseconds * (2 ** exponent));
}

export function asNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}
