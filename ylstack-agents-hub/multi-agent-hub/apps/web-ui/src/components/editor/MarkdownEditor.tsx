import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useWorkspaceStore, type WorkspaceFile } from "@/store/workspaceStore";
import { useWorkspace, useSaveFile, useResetMemory } from "@/hooks/useVFSClient";
import { useAutoLinting } from "@/hooks/useAutoLinting";
import { EditorToolbar } from "./EditorToolbar";
import { ValidationOverlay } from "./ValidationOverlay";
import { estimateTokens } from "@/lib/utils";
import { FileText } from "lucide-react";

export function MarkdownEditor() {
  const { agentId } = useParams<{ agentId: string }>();
  const files = useWorkspaceStore((s) => s.files);
  const updateFile = useWorkspaceStore((s) => s.updateFile);
  const markFileSaved = useWorkspaceStore((s) => s.markFileSaved);
  const setActiveAgentId = useWorkspaceStore((s) => s.setActiveAgentId);

  const [activePath, setActivePath] = useState("soul.md");
  const [showValidation, setShowValidation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const workspaceQuery = useWorkspace(agentId ?? "");
  const saveFileMutation = useSaveFile();
  const resetMemoryMutation = useResetMemory();

  const { errors, lint, clearErrors, hasErrors } = useAutoLinting();

  useEffect(() => {
    if (agentId) {
      setActiveAgentId(agentId);
    }
  }, [agentId, setActiveAgentId]);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activePath),
    [files, activePath],
  );

  // Auto-lint when tools.md content changes
  const toolsFile = useMemo(
    () => files.find((f) => f.path === "tools.md"),
    [files],
  );

  useEffect(() => {
    if (toolsFile?.content) {
      const res = lint(toolsFile.content);
      if (res.length > 0) {
        setShowValidation(true);
      }
    } else {
      clearErrors();
      setShowValidation(false);
    }
  }, [toolsFile?.content, lint, clearErrors]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateFile(activePath, e.target.value);
    },
    [activePath, updateFile],
  );

  const handleSave = useCallback(async () => {
    if (!agentId || !activeFile) return;
    setIsSaving(true);
    try {
      await saveFileMutation.mutateAsync({
        agentId,
        filePath: activeFile.path,
        content: activeFile.content,
      });
      markFileSaved(activeFile.path);
    } catch (err) {
      console.error("Failed to save file:", err);
    } finally {
      setIsSaving(false);
    }
  }, [agentId, activeFile, saveFileMutation, markFileSaved]);

  const handleBlur = useCallback(() => {
    if (activeFile?.isDirty) {
      handleSave();
    }
  }, [activeFile, handleSave]);

  const handleTabChange = useCallback(
    (path: string) => {
      // Save current file before switching
      if (activeFile?.isDirty) {
        handleSave();
      }
      setActivePath(path);
    },
    [activeFile, handleSave],
  );

  const handleResetMemory = useCallback(() => {
    if (!agentId) return;
    resetMemoryMutation.mutate(agentId);
  }, [agentId, resetMemoryMutation]);

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select an agent from the sidebar to edit its workspace files.</p>
        </div>
      </div>
    );
  }

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        <p className="text-sm">
          Failed to load workspace: {(workspaceQuery.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar
        activeFile={activePath}
        files={files}
        onTabChange={handleTabChange}
        onResetMemory={handleResetMemory}
        hasErrors={hasErrors}
        errorCount={errors.length}
        isSaving={isSaving}
      />

      <div className="relative flex-1">
        {activeFile && (
          <textarea
            key={activeFile.path}
            value={activeFile.content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            className="h-full w-full resize-none border-0 bg-background p-4 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/40 scrollbar-thin"
            placeholder={`Edit ${activeFile.name}...`}
            spellCheck={false}
          />
        )}

        <ValidationOverlay
          errors={errors}
          visible={showValidation}
          onClose={() => setShowValidation(false)}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-border bg-card px-3 py-1">
        <span className="text-[10px] text-muted-foreground">
          {activeFile?.name ?? "No file selected"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {activeFile ? `${activeFile.content.length} chars / ~${estimateTokens(activeFile.content)} tokens` : ""}
        </span>
      </div>
    </div>
  );
}