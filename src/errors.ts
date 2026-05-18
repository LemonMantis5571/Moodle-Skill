import type { ErrorCode, ToolError } from "./types.js"

export class ToolException extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryable = false,
    public details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export function toToolError(error: unknown): ToolError {
  if (error instanceof ToolException) {
    return { code: error.code, message: error.message, retryable: error.retryable, details: error.details }
  }
  return { code: "INTERNAL_ERROR", message: "Unexpected internal error", retryable: false }
}
