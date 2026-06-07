#!/usr/bin/env node

/**
 * Telegram CLI Simulator
 *
 * Sends mock webhook payloads to the local edge-hub for testing.
 * Can simulate various message types and delays.
 *
 * Usage:
 *   node telegram-cli.js --text "Hello agent" --delay 1000
 *   node telegram-cli.js --text "Create a code review agent" --source lead
 *   node telegram-cli.js --fuzz --count 100
 */

const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:8787/webhook/telegram';

function generatePayload(text, chatId, userId) {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: Math.floor(Math.random() * 10000),
      from: {
        id: userId ?? Math.floor(Math.random() * 100000),
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: `testuser_${userId ?? Math.floor(Math.random() * 1000)}`,
        language_code: 'en',
      },
      chat: {
        id: chatId ?? Math.floor(Math.random() * 100000),
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        type: 'private',
      },
      date: Math.floor(Date.now() / 1000),
      text: text ?? 'Hello from Telegram CLI simulator!',
    },
  };
}

function generateFuzzPayload() {
  const texts = [
    '/start',
    '/help',
    'Hello!',
    'Create a new agent called code-reviewer',
    "Update the code agent's soul.md to be stricter",
    "What's the weather like?",
    'Help me debug this error: TypeError: undefined is not a function',
    'List all agents',
    'Delete the test agent',
    'Analyze this code snippet: const x = 1;',
  ];
  const idx = Math.floor(Math.random() * texts.length);
  const chatId = Math.floor(Math.random() * 3) + 1; // 3 different chat IDs to test isolation
  return generatePayload(texts[idx], chatId);
}

async function sendPayload(payload, delay) {
  if (delay) await new Promise((r) => setTimeout(r, delay));
  const start = Date.now();
  try {
    const resp = await fetch(TARGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const time = Date.now() - start;
    console.log(`[${time}ms] ${resp.status}: ${payload.message?.text?.slice(0, 60)}`);
    return { ok: resp.ok, status: resp.status, time };
  } catch (err) {
    const time = Date.now() - start;
    console.log(`[${time}ms] ERROR: ${err.message}`);
    return { ok: false, error: err.message, time };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const text = args.includes('--text') ? args[args.indexOf('--text') + 1] : null;
  const delay = parseInt(args[args.indexOf('--delay') + 1]) || 0;
  const count = parseInt(args[args.indexOf('--count') + 1]) || 1;
  const fuzz = args.includes('--fuzz');

  console.log('=== Telegram CLI Simulator ===');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Mode: ${fuzz ? 'FUZZ' : 'SINGLE'}`);
  console.log(`Count: ${count}\n`);

  let totalTime = 0;
  let successCount = 0;

  for (let i = 0; i < count; i++) {
    const payload = fuzz ? generateFuzzPayload() : generatePayload(text);
    const result = await sendPayload(payload, i > 0 ? delay : 0);
    totalTime += result.time;
    if (result.ok) successCount++;
  }

  console.log(`\n=== Results ===`);
  console.log(`Sent: ${count}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${count - successCount}`);
  console.log(`Avg time: ${(totalTime / count).toFixed(0)}ms`);
}

main().catch(console.error);