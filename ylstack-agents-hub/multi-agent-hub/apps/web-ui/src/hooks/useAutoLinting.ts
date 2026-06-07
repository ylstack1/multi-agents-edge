import { useState, useCallback, useMemo } from "react";

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

/**
 * Hook that validates markdown/file content for issues.
 * Particularly useful for tools.md which often contains JSON frontmatter or code blocks.
 */
export function useAutoLinting() {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const validateMarkdown = useCallback((content: string): ValidationError[] => {
    const foundErrors: ValidationError[] = [];
    const lines = content.split("\n");

    // Check for JSON code blocks and validate them
    const jsonBlockRegex = /```json\s*([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = jsonBlockRegex.exec(content)) !== null) {
      const jsonStr = match[1];
      if (!jsonStr) continue;

      try {
        JSON.parse(jsonStr);
      } catch (e) {
        const errorStartLine =
          content.substring(0, match.index).split("\n").length;
        foundErrors.push({
          line: errorStartLine,
          column: 1,
          message: `Invalid JSON in code block: ${(e as Error).message}`,
          severity: "error",
        });
      }
    }

    // Check for YAML frontmatter
    const yamlFrontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const yamlMatch = content.match(yamlFrontmatterRegex);
    if (yamlMatch) {
      const fmLines = yamlMatch[1].split("\n");
      fmLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.includes(":")) {
          foundErrors.push({
            line: idx + 2,
            column: 1,
            message: `Invalid YAML frontmatter: "${trimmed}"`,
            severity: "warning",
          });
        }
      });
    }

    // Check for unclosed code fences
    const fenceCount = (content.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
      foundErrors.push({
        line: lines.length,
        column: 1,
        message: "Unclosed code fence detected",
        severity: "error",
      });
    }

    // Check for broken links (markdown links with no URL)
    const brokenLinkRegex = /\[([^\]]+)\]\(\)/g;
    while ((match = brokenLinkRegex.exec(content)) !== null) {
      const linkLine =
        content.substring(0, match.index).split("\n").length;
      foundErrors.push({
        line: linkLine + 1,
        column: match.index - content.lastIndexOf("\n", match.index),
        message: `Empty link URL for "${match[1]}"`,
        severity: "warning",
      });
    }

    return foundErrors;
  }, []);

  const lint = useCallback(
    (content: string) => {
      const foundErrors = validateMarkdown(content);
      setErrors(foundErrors);
      return foundErrors;
    },
    [validateMarkdown],
  );

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const hasErrors = useMemo(
    () => errors.some((e) => e.severity === "error"),
    [errors],
  );

  return {
    errors,
    lint,
    clearErrors,
    hasErrors,
  };
}