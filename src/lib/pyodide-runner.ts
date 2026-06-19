// Pyodide loader + Python execution helper.
// Loads Pyodide from the official CDN once, then exposes runPython(code, stdin).

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type PyodideInstance = {
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  setStdin: (opts: { stdin: () => string | null }) => void;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { set: (k: string, v: unknown) => void };
};

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>;
  }
}

let pyodidePromise: Promise<PyodideInstance> | null = null;

export function pyodideReady(): boolean {
  return Boolean(pyodidePromise);
}

export async function loadPyodideOnce(): Promise<PyodideInstance> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = PYODIDE_CDN;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Pyodide script"));
        document.head.appendChild(s);
      });
    }
    const py = await window.loadPyodide!({ indexURL: PYODIDE_INDEX });
    return py;
  })();
  return pyodidePromise;
}

export type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
};

function normalize(s: string): string {
  // Trim trailing whitespace per line and strip trailing newlines for fair comparison.
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

export async function runPython(code: string, stdin = ""): Promise<RunResult> {
  const py = await loadPyodideOnce();
  let stdout = "";
  let stderr = "";
  py.setStdout({ batched: (s: string) => (stdout += s + "\n") });
  py.setStderr({ batched: (s: string) => (stderr += s + "\n") });

  // Feed stdin as a buffer that Python's input() can read line by line.
  const lines = stdin.length ? stdin.replace(/\r\n/g, "\n").split("\n") : [];
  // If stdin string didn't end with newline, the last element is the final line; keep it.
  let idx = 0;
  py.setStdin({
    stdin: () => {
      if (idx >= lines.length) return null;
      const line = lines[idx++];
      return line;
    },
  });

  try {
    await py.runPythonAsync(code);
  } catch (err) {
    stderr += (err instanceof Error ? err.message : String(err)) + "\n";
    return { ok: false, stdout: normalize(stdout), stderr: normalize(stderr) };
  }
  return { ok: true, stdout: normalize(stdout), stderr: normalize(stderr) };
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalize(actual) === normalize(expected);
}
