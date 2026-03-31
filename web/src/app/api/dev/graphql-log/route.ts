import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Only active in development
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ ok: false, reason: 'dev only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { operation, variables, response, errors, timestamp } = body;

    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'graphql-dev.log');

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const entry = [
      `[${timestamp ?? new Date().toISOString()}] === GraphQL ${operation?.operationType ?? 'operation'}: ${operation?.operationName ?? '(anonymous)'} ===`,
      `Variables: ${JSON.stringify(variables ?? {}, null, 2)}`,
      errors
        ? `Errors: ${JSON.stringify(errors, null, 2)}`
        : `Response: ${JSON.stringify(response ?? {}, null, 2)}`,
      '',
    ].join('\n');

    fs.appendFileSync(logFile, entry, 'utf8');

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[graphql-log route] failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
