import * as React from "react";
import { cn } from "@/lib/utils";

// Colab-inspired Python syntax highlighter over a real <textarea>.
// The textarea sits transparently on top of a highlighted <pre> so caret,
// selection, and copy/paste keep working exactly like a normal textarea.

const KEYWORDS = new Set([
  "False","None","True","and","as","assert","async","await","break","class",
  "continue","def","del","elif","else","except","finally","for","from","global",
  "if","import","in","is","lambda","nonlocal","not","or","pass","raise","return",
  "try","while","with","yield","match","case",
]);

const BUILTINS = new Set([
  "abs","all","any","ascii","bin","bool","bytearray","bytes","callable","chr",
  "classmethod","compile","complex","delattr","dict","dir","divmod","enumerate",
  "eval","exec","filter","float","format","frozenset","getattr","globals",
  "hasattr","hash","help","hex","id","input","int","isinstance","issubclass",
  "iter","len","list","locals","map","max","memoryview","min","next","object",
  "oct","open","ord","pow","print","property","range","repr","reversed","round",
  "set","setattr","slice","sorted","staticmethod","str","sum","super","tuple",
  "type","vars","zip","__import__",
]);

type Tok = { t: string; c: string };

// Colors tuned to Colab's default (light) theme, works on our dark editor bg.
const COLORS: Record<string, string> = {
  kw:   "#ff7043", // orange — keywords
  bi:   "#26a69a", // teal — builtins
  def:  "#42a5f5", // blue — function/class names after def/class
  num:  "#ab47bc", // purple — numbers
  str:  "#66bb6a", // green — strings
  cmt:  "#8a99a8", // gray — comments (italic)
  dec:  "#ffa726", // amber — decorators @foo
  self: "#ef5350", // red — self / cls
  op:   "#cfd8dc", // light — operators/punct
  id:   "#eceff1", // near-white — identifiers
  ws:   "#eceff1",
};

function tokenizePython(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  // Track "just saw def/class" so the next identifier is coloured as a name.
  let expectName: "def" | "class" | null = null;

  while (i < n) {
    const ch = src[i];

    // Newline / whitespace — keep as-is.
    if (ch === "\n" || ch === " " || ch === "\t" || ch === "\r") {
      let j = i;
      while (j < n && (src[j] === " " || src[j] === "\t" || src[j] === "\r" || src[j] === "\n")) j++;
      out.push({ t: src.slice(i, j), c: "ws" });
      i = j;
      continue;
    }

    // Comment
    if (ch === "#") {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      out.push({ t: src.slice(i, j), c: "cmt" });
      i = j;
      continue;
    }

    // Triple-quoted string
    if ((ch === '"' || ch === "'") && src.slice(i, i + 3) === ch + ch + ch) {
      const q = ch + ch + ch;
      let j = i + 3;
      while (j < n && src.slice(j, j + 3) !== q) j++;
      j = Math.min(n, j + 3);
      out.push({ t: src.slice(i, j), c: "str" });
      i = j;
      continue;
    }

    // Single/double string (with escapes, single-line)
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      while (j < n && src[j] !== q && src[j] !== "\n") {
        if (src[j] === "\\" && j + 1 < n) j += 2;
        else j++;
      }
      if (j < n && src[j] === q) j++;
      out.push({ t: src.slice(i, j), c: "str" });
      i = j;
      continue;
    }

    // Decorator
    if (ch === "@") {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_.]/.test(src[j])) j++;
      out.push({ t: src.slice(i, j), c: "dec" });
      i = j;
      continue;
    }

    // Number
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9._xXoObBeEjJ+\-a-fA-F]/.test(src[j])) {
        // Stop the +/- unless part of exponent
        if ((src[j] === "+" || src[j] === "-") && !/[eE]/.test(src[j - 1] ?? "")) break;
        j++;
      }
      out.push({ t: src.slice(i, j), c: "num" });
      i = j;
      continue;
    }

    // Identifier / keyword / builtin
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      let cls: string;
      if (expectName) {
        cls = "def";
        expectName = null;
      } else if (KEYWORDS.has(word)) {
        cls = "kw";
        if (word === "def" || word === "class") expectName = word;
      } else if (BUILTINS.has(word)) {
        cls = "bi";
      } else if (word === "self" || word === "cls") {
        cls = "self";
      } else {
        cls = "id";
      }
      out.push({ t: word, c: cls });
      i = j;
      continue;
    }

    // Operator / punctuation (single char)
    out.push({ t: ch, c: "op" });
    i++;
  }

  return out;
}

function Highlighted({ code }: { code: string }) {
  // Ensure trailing newline renders a line so the overlay height matches the textarea.
  const source = code.endsWith("\n") ? code + " " : code;
  const toks = React.useMemo(() => tokenizePython(source), [source]);
  return (
    <>
      {toks.map((tok, i) => (
        <span
          key={i}
          style={{
            color: COLORS[tok.c] ?? COLORS.id,
            fontStyle: tok.c === "cmt" ? "italic" : undefined,
            fontWeight: tok.c === "kw" || tok.c === "def" ? 600 : undefined,
          }}
        >
          {tok.t}
        </span>
      ))}
    </>
  );
}

export type PythonCodeEditorProps = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
  spellCheck?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  ariaLabel?: string;
};

export const PythonCodeEditor = React.forwardRef<HTMLTextAreaElement, PythonCodeEditorProps>(
  function PythonCodeEditor(
    { value, onChange, rows = 14, className, style, spellCheck = false, readOnly, disabled, onKeyDown, ariaLabel },
    ref,
  ) {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const preRef = React.useRef<HTMLPreElement | null>(null);
    // Merge refs
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    // Keep highlight scroll in sync with textarea scroll.
    const syncScroll = React.useCallback(() => {
      const ta = innerRef.current;
      const pre = preRef.current;
      if (!ta || !pre) return;
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    }, []);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Tab") {
          e.preventDefault();
          const el = e.currentTarget;
          const s = el.selectionStart;
          const next = value.slice(0, s) + "    " + value.slice(el.selectionEnd);
          onChange(next);
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = s + 4;
          });
        }
      },
      [onKeyDown, onChange, value],
    );

    const sharedStyle: React.CSSProperties = {
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 14,
      lineHeight: 1.55,
      tabSize: 4,
      padding: "12px 16px",
      whiteSpace: "pre",
      margin: 0,
      border: 0,
      background: "transparent",
    };

    return (
      <div className={cn("pyk-code-editor relative w-full", className)} style={style}>
        <style>{`.pyk-code-editor .pyk-pre::-webkit-scrollbar{display:none}`}</style>
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pyk-pre pointer-events-none block w-full overflow-auto"
          style={{
            ...sharedStyle,
            color: COLORS.id,
            minHeight: `calc(${rows} * 1.55em + 24px)`,
            scrollbarWidth: "none",
          }}
        >
          <Highlighted code={value} />
        </pre>
        <textarea
          ref={innerRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={spellCheck}
          readOnly={readOnly}
          disabled={disabled}
          rows={rows}
          aria-label={ariaLabel}
          className="absolute inset-0 block w-full outline-none"
          style={{
            ...sharedStyle,
            color: "transparent",
            caretColor: "#ffffff",
            background: "transparent",
            WebkitTextFillColor: "transparent",
            resize: "none",
            overflow: "auto",
          }}
        />
      </div>
    );
  },
);
