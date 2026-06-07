import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Load mock tools
let mockTools = [];
const toolsPath = new URL('./mock-tools.json', import.meta.url);
if (existsSync(toolsPath)) {
  mockTools = JSON.parse(readFileSync(toolsPath, 'utf-8'));
}

// SSE endpoint — simulates MCP tool discovery and execution
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send tool discovery response
  const discoveryEvent = {
    jsonrpc: '2.0',
    id: 1,
    result: {
      tools: mockTools,
    },
  };

  res.write(`event: message\n`);
  res.write(`data: ${JSON.stringify(discoveryEvent)}\n\n`);

  // Keep alive pings
  const keepAlive = setInterval(() => {
    res.write(`:keepalive\n\n`);
  }, 10000);

  req.on('close', () => {
    clearInterval(keepAlive);
    res.end();
  });
});

// Tool execution endpoint
app.post('/tools/call', (req, res) => {
  const { name, arguments: args } = req.body ?? {};

  console.log(`[Mock MCP] Tool called: ${name}`, args);

  // Simulate latency (100-500ms)
  const delay = Math.floor(Math.random() * 400) + 100;

  setTimeout(() => {
    res.json({
      jsonrpc: '2.0',
      id: 2,
      result: {
        content: [
          {
            type: 'text',
            text: `Mock result for "${name}" executed with args: ${JSON.stringify(args)}`,
          },
        ],
        isError: false,
      },
    });
  }, delay);
});

// Tools list endpoint
app.get('/tools', (req, res) => {
  res.json({
    jsonrpc: '2.0',
    id: 1,
    result: {
      tools: mockTools,
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`[Mock MCP Server] Running on http://localhost:${PORT}`);
  console.log(`[Mock MCP Server] SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`[Mock MCP Server] Tools available: ${mockTools.length}`);
});