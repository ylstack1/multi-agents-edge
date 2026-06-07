import React, { useState } from "react";
import {
  TestTube,
  Plus,
  Trash2,
  Play,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface MockTool {
  id: string;
  name: string;
  response: string;
}

export function MockToolInjector() {
  const [isOpen, setIsOpen] = useState(false);
  const [mockTools, setMockTools] = useState<MockTool[]>([]);
  const [newName, setNewName] = useState("");
  const [newResponse, setNewResponse] = useState("");

  const addMockTool = () => {
    if (!newName.trim() || !newResponse.trim()) return;
    const tool: MockTool = {
      id: Math.random().toString(36).substring(2, 9),
      name: newName.trim(),
      response: newResponse.trim(),
    };
    setMockTools([...mockTools, tool]);
    setNewName("");
    setNewResponse("");
  };

  const removeMockTool = (id: string) => {
    setMockTools(mockTools.filter((t) => t.id !== id));
  };

  const simulateResponse = (tool: MockTool) => {
    const simulatedEvent = new CustomEvent("mcp:mock-response", {
      detail: {
        toolName: tool.name,
        response: tool.response,
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(simulatedEvent);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-2">
          <TestTube size={14} className="text-purple-400" />
          <span className="text-xs font-medium text-foreground">
            Mock Tool Injector
          </span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-[10px] text-muted-foreground/60">
            Simulate MCP tool responses for testing without a real MCP server.
          </p>

          {/* Existing mock tools */}
          {mockTools.length > 0 && (
            <div className="space-y-2">
              {mockTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-start gap-2 rounded-md bg-muted/30 p-2"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-foreground">
                        {tool.name}
                      </span>
                    </div>
                    <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground/70">
                      {tool.response}
                    </pre>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => simulateResponse(tool)}
                      className="rounded p-1 text-green-400 transition-colors hover:bg-green-500/20"
                      title="Simulate response"
                    >
                      <Play size={12} />
                    </button>
                    <button
                      onClick={() => removeMockTool(tool.id)}
                      className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/20"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new mock tool */}
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tool name (e.g., get_weather)"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring"
            />
            <textarea
              value={newResponse}
              onChange={(e) => setNewResponse(e.target.value)}
              placeholder='Tool response (e.g., {"temperature": 72})'
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring"
            />
            <button
              onClick={addMockTool}
              disabled={!newName.trim() || !newResponse.trim()}
              className="flex w-full items-center justify-center gap-1 rounded-md bg-purple-500/20 px-2 py-1.5 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={12} />
              Add Mock Tool
            </button>
          </div>
        </div>
      )}
    </div>
  );
}