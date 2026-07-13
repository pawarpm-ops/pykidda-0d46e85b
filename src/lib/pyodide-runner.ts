// Pyodide runner: runs Python inside a Web Worker so the main thread stays
// responsive even for infinite loops / heavy code. Provides timeout, output
// limits, and a cancel/stop API. Backwards compatible with the old surface:
//   loadPyodideOnce, runPython, outputsMatch, pyodideReady, RunResult.

import { logHealthEventClient } from "@/lib/system-health-client";

const WORKER_URL = "/pyodide-worker.js";

export type RunReason =
  | "ok"
  | "error"
  | "syntax_error"
  | "timeout"
  | "output_limit"
  | "stopped"
  | "load_failed";

export type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  reason?: RunReason;
};

export type RunOptions = {
  /** Hard wall-clock limit for the run (ms). Default 8000. */
  timeoutMs?: number;
  /** Maximum combined stdout+stderr characters. Default 10_000. */
  maxChars?: number;
  /** Maximum number of print/newline chunks. Default 200. */
  maxLines?: number;
};

type WorkerMsg =
  | { type: "ready" }
  | { type: "load_failed"; message: string }
  | { type: "output_limit"; runId: number }
  | {
      type: "done";
      runId: number;
      ok: boolean;
      stdout: string;
      stderr: string;
      reason: RunReason;
    };

let worker: Worker | null = null;
let ready = false;
let loadPromise: Promise<void> | null = null;

type Pending = {
  runId: number;
  resolve: (r: RunResult) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
};
let currentRun: Pending | null = null;
let nextRunId = 1;

function normalize(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

function friendlyStderr(reason: RunReason, raw: string): string {
  switch (reason) {
    case "timeout":
      return "Time Limit Exceeded: Your code took too long to run.";
    case "output_limit":
      return "Output Limit Exceeded: Your code printed too much output.";
    case "stopped":
      return "Execution stopped by user.";
    case "load_failed":
      return `Python engine failed to load. ${raw || ""}`.trim();
    case "syntax_error":
      return `Syntax Error: Please check your Python syntax.\n${raw}`;
    default:
      return raw;
  }
}

function teardownWorker() {
  if (worker) {
    try {
      worker.terminate();
    } catch {
      /* ignore */
    }
  }
  worker = null;
  ready = false;
  loadPromise = null;
}

function finishRun(result: RunResult, terminate: boolean) {
  if (!currentRun) return;
  const { resolve, timeoutId } = currentRun;
  if (timeoutId) clearTimeout(timeoutId);
  currentRun = null;
  if (terminate) teardownWorker();
  resolve(result);
}

function attachWorker(w: Worker) {
  w.onmessage = (e: MessageEvent<WorkerMsg>) => {
    const msg = e.data;
    if (!msg) return;
    if (msg.type === "ready") {
      ready = true;
      return;
    }
    if (msg.type === "output_limit") {
      if (currentRun && currentRun.runId === msg.runId) {
        finishRun(
          {
            ok: false,
            stdout: "",
            stderr: friendlyStderr("output_limit", ""),
            reason: "output_limit",
          },
          true,
        );
      }
      return;
    }
    if (msg.type === "done") {
      if (currentRun && currentRun.runId === msg.runId) {
        finishRun(
          {
            ok: msg.ok,
            stdout: normalize(msg.stdout || ""),
            stderr: friendlyStderr(msg.reason, normalize(msg.stderr || "")),
            reason: msg.reason,
          },
          false,
        );
      }
      return;
    }
  };
  w.onerror = () => {
    if (currentRun) {
      finishRun(
        {
          ok: false,
          stdout: "",
          stderr: "Worker crashed. Please try again.",
          reason: "error",
        },
        true,
      );
    } else {
      teardownWorker();
    }
  };
}

function spawnAndLoad(): Promise<void> {
  const w = new Worker(WORKER_URL);
  worker = w;
  ready = false;
  const p = new Promise<void>((resolve, reject) => {
    const onMsg = (e: MessageEvent<WorkerMsg>) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === "ready") {
        w.removeEventListener("message", onMsg);
        resolve();
      } else if (msg.type === "load_failed") {
        w.removeEventListener("message", onMsg);
        reject(new Error(msg.message || "Python engine load failed"));
      }
    };
    w.addEventListener("message", onMsg);
    attachWorker(w);
    w.postMessage({ type: "load" });
  });
  loadPromise = p;
  p.catch(() => {
    // Reset so a retry can attempt fresh load.
    teardownWorker();
  });
  return p;
}

export function pyodideReady(): boolean {
  return ready;
}

export function isRunning(): boolean {
  return !!currentRun;
}

export async function loadPyodideOnce(): Promise<void> {
  if (ready) return;
  if (loadPromise) return loadPromise;
  return spawnAndLoad();
}

export async function runPython(
  code: string,
  stdin = "",
  opts: RunOptions = {},
): Promise<RunResult> {
  if (currentRun) {
    return {
      ok: false,
      stdout: "",
      stderr:
        "Another program is already running. Please wait or click Stop Execution.",
      reason: "error",
    };
  }
  try {
    await loadPyodideOnce();
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: friendlyStderr(
        "load_failed",
        e instanceof Error ? e.message : String(e),
      ),
      reason: "load_failed",
    };
  }
  if (!worker) {
    // Very unlikely, but guard.
    try {
      await spawnAndLoad();
    } catch (e) {
      return {
        ok: false,
        stdout: "",
        stderr: friendlyStderr(
          "load_failed",
          e instanceof Error ? e.message : String(e),
        ),
        reason: "load_failed",
      };
    }
  }

  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxChars = opts.maxChars ?? 10000;
  const maxLines = opts.maxLines ?? 200;
  const runId = nextRunId++;

  return new Promise<RunResult>((resolve) => {
    const timeoutId = setTimeout(() => {
      finishRun(
        {
          ok: false,
          stdout: "",
          stderr: friendlyStderr("timeout", ""),
          reason: "timeout",
        },
        true,
      );
    }, timeoutMs);
    currentRun = { runId, resolve, timeoutId };
    worker!.postMessage({
      type: "run",
      runId,
      code,
      stdin,
      maxChars,
      maxLines,
    });
  });
}

/**
 * Stop the currently running Python program (if any). Terminates the worker
 * and lazily spins up a fresh one on the next run. Safe to call when idle.
 */
export function cancelPython(): void {
  if (!currentRun) return;
  finishRun(
    {
      ok: false,
      stdout: "",
      stderr: friendlyStderr("stopped", ""),
      reason: "stopped",
    },
    true,
  );
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalize(actual) === normalize(expected);
}

// Best-effort cleanup on tab close.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    teardownWorker();
  });
}
