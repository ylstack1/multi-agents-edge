#!/usr/bin/env node

/**
 * Security Fuzzer
 *
 * Tests path traversal, injection, and boundary violations against
 * the edge-hub API endpoints.
 *
 * Usage:
 *   node security-fuzzer.js
 *   TARGET_URL=http://localhost:8787 node security-fuzzer.js
 */

const TARGET_URL = process.env.TARGET_URL ?? 'http://localhost:8787';

const TRAVERSAL_PAYLOADS = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32',
  '....//....//....//etc/shadow',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2f',
  '..%252f..%252f..%252f',
  '/../../../etc/passwd',
  '.../.../.../etc/passwd',
  '....//....//etc/hosts',
  '..;/..;/../',
  '../../etc/passwd%00',
];

const INVALID_FILENAMES = [
  'passwd',
  'config.json',
  '.env',
  'soul.txt',
  'IDENTITY.MD',
  'memory',
  '../../../soul.md',
  'tools.json',
  'script.js',
  'Dockerfile',
];

const INJECTION_PAYLOADS = [
  { content: '${process.env.OPENAI_API_KEY}', file: 'soul.md' },
  { content: '`cat /etc/passwd`', file: 'memory.md' },
  { content: '{{constructor.constructor("return process")()}}', file: 'identity.md' },
  { content: '<script>alert("xss")</script>', file: 'user.md' },
  { content: 'import os; os.system("rm -rf /")', file: 'tools.md' },
];

async function testEndpoint(method, path, body) {
  const url = `${TARGET_URL}${path}`;
  try {
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    return { status: resp.status, body: text.slice(0, 200) };
  } catch (err) {
    return { status: 'NETWORK_ERROR', body: err.message };
  }
}

function printResult(label, result) {
  const ok = result.status === 400 || result.status === 401 || result.status === 403 || result.status === 404;
  const icon = ok ? '✅' : '⚠️';
  console.log(`${icon} [${result.status}] ${label}`);
}

async function main() {
  console.log('=== Security Fuzzer ===');
  console.log(`Target: ${TARGET_URL}\n`);

  let totalTests = 0;
  let passedTests = 0;

  // 1. Path traversal tests
  console.log('--- Path Traversal ---');
  for (const payload of TRAVERSAL_PAYLOADS) {
    totalTests++;
    const result = await testEndpoint('GET', `/api/workspaces/${payload}`);
    printResult(`GET /api/workspaces/${payload}`, result);
    if (result.status === 400 || result.status === 401 || result.status === 403) passedTests++;
  }

  // 2. Invalid filenames
  console.log('\n--- Invalid Filenames ---');
  for (const file of INVALID_FILENAMES) {
    totalTests++;
    const result = await testEndpoint('GET', `/api/workspaces/test/files/${file}`);
    printResult(`GET /api/workspaces/test/files/${file}`, result);
    if (result.status === 400 || result.status === 401 || result.status === 404) passedTests++;
  }

  // 3. Injection payloads in file content
  console.log('\n--- Content Injection ---');
  for (const payload of INJECTION_PAYLOADS) {
    totalTests++;
    const result = await testEndpoint('PUT', `/api/workspaces/test/files/${payload.file}`, {
      content: payload.content,
    });
    printResult(`PUT ${payload.file} with injection`, result);
    if (result.status === 400 || result.status === 401 || result.status === 403) passedTests++;
  }

  // 4. Invalid JSON bodies
  console.log('\n--- Malformed Requests ---');
  const badBodies = [
    'not-json',
    '{invalid}',
    '{"unclosed": "string',
    null,
    undefined,
  ];
  for (const body of badBodies) {
    totalTests++;
    const result = await testEndpoint('POST', '/api/chat/test', body);
    printResult(`POST /api/chat/test with malformed body`, result);
    if (result.status === 400 || result.status === 401 || result.status === 422 || result.status === 500) passedTests++;
  }

  // Summary
  console.log(`\n=== Results ===`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed (blocked): ${passedTests}`);
  console.log(`Failed (allowed): ${totalTests - passedTests}`);
  console.log(`Security score: ${(passedTests / totalTests * 100).toFixed(0)}%`);
}

main().catch(console.error);