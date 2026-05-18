#!/usr/bin/env node
import { loadConfig } from "./config.js"
import { executeCommand } from "./commands.js"

function parseArgv(argv: string[]): { command: string; params: Record<string, string>; json: boolean } {
  const [command, ...rest] = argv
  const params: Record<string, string> = {}
  let json = false
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]
    if (token === "--json") {
      json = true
      continue
    }
    if (token.startsWith("--")) {
      const key = token.slice(2)
      const value = rest[i + 1]
      if (value && !value.startsWith("--")) {
        params[key] = value
        i++
      }
    }
  }
  return { command: command || "", params, json }
}

function exitCode(result: { ok: boolean; error: { code: string } | null }): number {
  if (result.ok) return 0
  const code = result.error?.code || "INTERNAL_ERROR"
  if (code === "AUTH_INVALID_TOKEN" || code === "AUTH_MISSING_CREDENTIALS") return 3
  if (code === "VALIDATION_ERROR") return 2
  if (code === "UPSTREAM_ERROR" || code === "SERVICE_DISABLED") return 4
  return 5
}

async function main() {
  const { command, params, json } = parseArgv(process.argv.slice(2))
  const cfg = loadConfig()
  const res = await executeCommand(command, params, cfg)
  if (json) {
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`)
  } else {
    process.stdout.write(`${JSON.stringify(res)}\n`)
  }
  process.exit(exitCode(res))
}

main().catch((error) => {
  process.stdout.write(
    `${JSON.stringify({ ok: false, data: null, warnings: [], error: { code: "INTERNAL_ERROR", message: `${error}`, retryable: false } })}\n`,
  )
  process.exit(5)
})
