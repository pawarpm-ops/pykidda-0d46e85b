/* Pyodide Web Worker — runs Python off the main thread. */
/* eslint-disable no-restricted-globals */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodide = null;
let loadPromise = null;

async function ensureLoaded() {
  if (pyodide) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        self.importScripts(`${PYODIDE_INDEX}pyodide.js`);
      } catch (e) {
        // Fallback CDN
        self.importScripts(
          `https://unpkg.com/pyodide@${PYODIDE_VERSION}/pyodide.js`,
        );
      }
      pyodide = await self.loadPyodide({ indexURL: PYODIDE_INDEX });
    })();
  }
  await loadPromise;
}

self.onmessage = async (e) => {
  const msg = e.data || {};

  if (msg.type === "load") {
    try {
      await ensureLoaded();
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({
        type: "load_failed",
        message: err && err.message ? String(err.message) : String(err),
      });
    }
    return;
  }

  if (msg.type === "run") {
    const { runId, code, stdin, maxChars, maxLines } = msg;
    try {
      await ensureLoaded();
    } catch (err) {
      self.postMessage({
        type: "done",
        runId,
        ok: false,
        stdout: "",
        stderr: err && err.message ? String(err.message) : String(err),
        reason: "load_failed",
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let lineCount = 0;
    let limitHit = false;
    const cap = typeof maxChars === "number" ? maxChars : 10000;
    const maxL = typeof maxLines === "number" ? maxLines : 200;

    const write = (s, isErr) => {
      if (limitHit) return;
      const chunk = s + "\n";
      if (isErr) stderr += chunk;
      else stdout += chunk;
      lineCount++;
      if (stdout.length + stderr.length > cap || lineCount > maxL) {
        limitHit = true;
        // Notify main immediately with partial output so it can display truncated results.
        self.postMessage({ type: "output_limit", runId, stdout, stderr });
        // Throw to interrupt Python execution.
        throw new Error("__PYKIDDA_OUTPUT_LIMIT__");
      }
    };

    pyodide.setStdout({ batched: (s) => write(s, false) });
    pyodide.setStderr({ batched: (s) => write(s, true) });

    const inputLines = stdin
      ? String(stdin).replace(/\r\n/g, "\n").split("\n")
      : [];
    let idx = 0;
    pyodide.setStdin({
      stdin: () => (idx >= inputLines.length ? null : inputLines[idx++]),
    });

    try {
      await pyodide.runPythonAsync(code);
      self.postMessage({
        type: "done",
        runId,
        ok: true,
        stdout,
        stderr,
        reason: "ok",
      });
    } catch (err) {
      if (limitHit) {
        self.postMessage({
          type: "done",
          runId,
          ok: false,
          stdout,
          stderr,
          reason: "output_limit",
        });
      } else {
        const message =
          err && err.message ? String(err.message) : String(err);
        self.postMessage({
          type: "done",
          runId,
          ok: false,
          stdout,
          stderr: stderr + message + "\n",
          reason: /SyntaxError/i.test(message) ? "syntax_error" : "error",
        });
      }
    }
  }
};
