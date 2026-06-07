/**
 * R2 Concurrency & Latency Probe
 *
 * Tests concurrent fetching of mock markdown files from an S3-compatible endpoint
 * to validate whether parallel fetching meets latency requirements.
 *
 * Usage:
 *   export R2_ENDPOINT=https://my-r2-endpoint.com
 *   export R2_BUCKET=my-bucket
 *   node src/probe.js
 */

const R2_ENDPOINT = process.env.R2_ENDPOINT ?? 'http://localhost:9000';
const R2_BUCKET = process.env.R2_BUCKET ?? 'midas-workspaces-dev';
const AGENT_ID = process.env.AGENT_ID ?? 'probe-agent';
const FILES = ['soul.md', 'identity.md', 'user.md', 'memory.md', 'tools.md'];

async function probe() {
  console.log('=== R2 Concurrency & Latency Probe ===\n');
  console.log(`Endpoint: ${R2_ENDPOINT}`);
  console.log(`Bucket:   ${R2_BUCKET}`);
  console.log(`Agent:    ${AGENT_ID}`);
  console.log(`Files:    ${FILES.join(', ')}\n`);

  // Sequential fetch (baseline)
  console.log('--- Sequential Fetch ---');
  const seqStart = Date.now();
  for (const file of FILES) {
    const url = `${R2_ENDPOINT}/${R2_BUCKET}/${AGENT_ID}/${encodeURIComponent(file)}`;
    const start = Date.now();
    try {
      const resp = await fetch(url);
      const time = Date.now() - start;
      console.log(`  ${file}: ${resp.status} (${time}ms)`);
    } catch (err) {
      const time = Date.now() - start;
      console.log(`  ${file}: ERROR (${time}ms) - ${err.message}`);
    }
  }
  const seqTotal = Date.now() - seqStart;
  console.log(`\nSequential total: ${seqTotal}ms\n`);

  // Concurrent fetch
  console.log('--- Concurrent Fetch ---');
  const conStart = Date.now();
  const results = await Promise.allSettled(
    FILES.map(async (file) => {
      const url = `${R2_ENDPOINT}/${R2_BUCKET}/${AGENT_ID}/${encodeURIComponent(file)}`;
      const start = Date.now();
      try {
        const resp = await fetch(url);
        const time = Date.now() - start;
        return { file, status: resp.status, time };
      } catch (err) {
        const time = Date.now() - start;
        return { file, status: 'ERROR', time, error: err.message };
      }
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const r = result.value;
      console.log(`  ${r.file}: ${r.status} (${r.time}ms)`);
    }
  }

  const conTotal = Date.now() - conStart;
  console.log(`\nConcurrent total: ${conTotal}ms`);
  console.log(`Speedup: ${(seqTotal / Math.max(conTotal, 1)).toFixed(2)}x\n`);

  if (conTotal < 1000) {
    console.log('✅ CONCURRENT FETCH WITHIN BUDGET: < 1s');
  } else {
    console.log(`⚠️  Concurrent fetch took ${conTotal}ms — KV cache recommended`);
  }

  console.log('\n=== Probe Complete ===');
}

probe().catch(console.error);