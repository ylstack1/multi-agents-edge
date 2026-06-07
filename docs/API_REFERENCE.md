# API Reference

> Complete API documentation for the Multi-Agent Hub Edge Worker.

Base URL: `https://multi-agent-hub.your-account.workers.dev` (production) or `http://localhost:8787` (local dev)

## Authentication

All `/api/*` routes require authentication (except `/health` and `/webhook/telegram`).

**Header:** `Authorization: Bearer <token>` or `X-Session-Token: <token>`

The token is a Base64-encoded string in the format `agentId:source`.

**Example:**
```bash
# Encode token
echo -n 'admin:dashboard' | base64
# YWRtaW46ZGFzaGJvYXJk

# Use in request
curl -H "Authorization: Bearer YWRtaW46ZGFzaGJvYXJk" http://localhost:8787/api/agents
```

> **Note:** Production deployments should replace this with proper JWT or OAuth.

---

## Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "ok": true,
  "version": "0.1.0"
}
```

---

### Chat

#### Send Message

```
POST /api/chat/:agentId
```

Send a message to an agent and receive a complete response.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Request Body:**
```json
{
  "message": "Hello! What can you help me with?",
  "stream": false
}
```

**Response (non-streaming):**
```json
{
  "response": "I'm a multi-agent system. I can help you with...",
  "trace": {
    "nodes": [
      { "type": "user_request", "duration": 10 },
      { "type": "lead_analysis", "duration": 200 },
      { "type": "sub_agent_assignment", "duration": 1500 },
      { "type": "lead_synthesis", "duration": 300 }
    ]
  }
}
```

#### Stream Message

```
POST /api/chat/:agentId/stream
```

Same as above but returns an SSE stream for real-time token delivery.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Request Body:**
```json
{
  "message": "Write a short poem about coding."
}
```

**Response (SSE stream):**
```
event: token
data: {"token": "Here", "type": "text"}

event: token
data: {"token": "'s", "type": "text"}

event: token
data: {"token": " a", "type": "text"}

...

event: done
data: {"finishReason": "stop", "usage": {"inputTokens": 150, "outputTokens": 45}}
```

---

### Agents

#### List Agents

```
GET /api/agents
```

Returns all known agents with their workspace metadata.

**Response:**
```json
{
  "agents": [
    {
      "agentId": "my-first-agent",
      "role": "coding mentor",
      "fileCount": 5,
      "lastModified": "2026-06-01T12:00:00Z"
    }
  ]
}
```

#### Spawn Agent

```
POST /api/agents
```

Create a new sub-agent with initial markdown files.

**Request Body:**
```json
{
  "agentId": "my-new-agent",
  "soul": "You are a friendly assistant specialized in debugging.",
  "identity": "Role: debug expert\nExpertise: JavaScript, Python",
  "tools": "[{\"name\": \"search_code\", \"description\": \"Search codebase\", \"inputSchema\": {}}]"
}
```

All fields except `agentId` are optional. Creates `soul.md`, `identity.md`, `user.md`, `memory.md` (initialized with a welcome message), and `tools.md`.

**Response:**
```json
{
  "success": true,
  "agentId": "my-new-agent",
  "workspace": "agents/my-new-agent/files"
}
```

#### Get Agent Diff Log

```
GET /api/agents/:agentId/diff
```

Returns the trace/diff history for an agent.

**Response:**
```json
{
  "diffs": [
    {
      "timestamp": "2026-06-01T12:00:00Z",
      "file": "memory.md",
      "diff": [
        { "type": "insert", "line": 5, "text": "User asked about..." }
      ]
    }
  ]
}
```

#### Delete Agent

```
DELETE /api/agents/:agentId
```

Permanently deletes an agent and its workspace.

**Response:**
```json
{
  "success": true,
  "agentId": "my-new-agent"
}
```

---

### Workspaces

#### List Workspaces

```
GET /api/workspaces
```

**Response:**
```json
{
  "workspaces": ["agents/my-first-agent", "agents/my-new-agent"]
}
```

#### Get Workspace

```
GET /api/workspaces/:workspaceId
```

Returns all files in the workspace.

**Response:**
```json
{
  "workspaceId": "agents/my-first-agent/files",
  "files": {
    "soul.md": {
      "content": "You are a helpful coding assistant...",
      "lastModified": "2026-06-01T12:00:00Z"
    },
    "identity.md": { "content": "...", "lastModified": "..." },
    "memory.md": { "content": "...", "lastModified": "..." },
    "user.md": { "content": "...", "lastModified": "..." },
    "tools.md": { "content": "...", "lastModified": "..." }
  }
}
```

#### Get File

```
GET /api/workspaces/:workspaceId/files/:fileName
```

**Response:**
```json
{
  "content": "# Personality\n\nYou are a helpful...",
  "lastModified": "2026-06-01T12:00:00Z",
  "fileName": "soul.md"
}
```

#### Write File

```
PUT /api/workspaces/:workspaceId/files/:fileName
```

**Request Body:**
```json
{
  "content": "# Personality\n\nUpdated content..."
}
```

**Response:**
```json
{
  "success": true,
  "diff": [
    { "type": "delete", "line": 3, "text": "old content" },
    { "type": "insert", "line": 3, "text": "new content" }
  ]
}
```

#### Delete Workspace

```
DELETE /api/workspaces/:workspaceId
```

**Response:**
```json
{ "success": true }
```

#### Reset Memory

```
POST /api/workspaces/:workspaceId/reset-memory
```

Clears the `memory.md` content to its initial state.

**Response:**
```json
{ "success": true, "file": "memory.md" }
```

---

### MCP (Model Context Protocol)

#### Configure Endpoint

```
POST /api/mcp/configure
```

Register an MCP server endpoint.

**Request Body:**
```json
{
  "serverUrl": "https://mcp.example.com/sse",
  "name": "my-tools",
  "headers": { "Authorization": "Bearer token" }
}
```

**Response:**
```json
{
  "success": true,
  "endpointId": "my-tools",
  "status": "connected"
}
```

#### Discover Tools

```
POST /api/mcp/discover
```

Connect to an MCP server and discover available tools.

**Request Body:**
```json
{
  "serverUrl": "https://mcp.example.com/sse"
}
```

**Response:**
```json
{
  "serverInfo": { "name": "example-mcp", "version": "1.0.0" },
  "tools": [
    {
      "name": "search_web",
      "description": "Search the web for information",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query" }
        },
        "required": ["query"]
      },
      "translated": {
        "function": {
          "name": "search_web",
          "description": "...",
          "parameters": { ... }
        }
      }
    }
  ]
}
```

#### Execute Tool

```
POST /api/mcp/execute
```

Execute a tool on a connected MCP server.

**Request Body:**
```json
{
  "serverUrl": "https://mcp.example.com/sse",
  "toolName": "search_web",
  "arguments": { "query": "Cloudflare Workers best practices" }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "content": [
      { "type": "text", "text": "...search results..." }
    ]
  },
  "duration": 450
}
```

---

### Telegram Webhook

#### Webhook Receiver

```
POST /webhook/telegram
```

Receives Telegram bot updates. No authentication required (verified by bot token internally).

**Request Body:** Standard [Telegram Update](https://core.telegram.org/bots/api#update) object.

**Response:**
```json
{ "ok": true }
```

#### Set Webhook

```
POST /webhook/telegram/set-webhook
```

Helper endpoint to configure the Telegram webhook URL.

**Request Body:**
```json
{
  "url": "https://multi-agent-hub.your-account.workers.dev/webhook/telegram"
}
```

**Response:**
```json
{ "ok": true, "result": true }
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "WORKSPACE_NOT_FOUND",
    "message": "Workspace not found: agents/nonexistent/files"
  }
}
```

### Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `INVALID_INPUT` | Request body validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid auth token |
| 403 | `FORBIDDEN` | Auth token valid but insufficient permissions |
| 403 | `PATH_TRAVERSAL` | Attempted to access file outside allowed path |
| 404 | `WORKSPACE_NOT_FOUND` | Specified workspace does not exist |
| 404 | `FILE_NOT_FOUND` | Specified file does not exist in workspace |
| 408 | `MCP_TIMEOUT` | MCP server connection or tool execution timed out |
| 502 | `MCP_CONNECTION_ERROR` | Failed to connect to MCP server |
| 502 | `LLM_ERROR` | LLM provider returned an error |
| 413 | `PROMPT_OVERFLOW` | Compiled prompt exceeds token budget |
| 500 | `INTERNAL_ERROR` | Unexpected internal error |