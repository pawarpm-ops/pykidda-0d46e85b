import { memo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

type Props = {
  content: string;
  compact?: boolean;
};

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  const isDiff = lang === "diff";
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-[hsl(220_18%_10%)] text-[11px] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white/80 hover:bg-white/10"
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-2 leading-relaxed">
        <code className="font-mono text-slate-100">
          {lines.map((line, i) => {
            let cls = "block";
            if (isDiff) {
              if (line.startsWith("+"))
                cls += " bg-emerald-500/15 text-emerald-300";
              else if (line.startsWith("-"))
                cls += " bg-rose-500/15 text-rose-300";
              else cls += " text-slate-300";
            }
            return (
              <span key={i} className={cls}>
                {line || " "}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h3 className="mt-2 mb-1 text-sm font-bold text-foreground">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-2 mb-1 text-xs font-bold uppercase tracking-wide text-primary">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h4 className="mt-2 mb-1 text-xs font-bold text-foreground">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-1 text-xs leading-relaxed text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-1 ml-4 list-disc space-y-0.5 text-xs text-foreground marker:text-primary">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-4 list-decimal space-y-0.5 text-xs text-foreground marker:font-semibold marker:text-primary">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 rounded-r-md border-l-2 border-primary/60 bg-primary/5 px-2 py-1 text-xs italic text-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md border border-border">
      <table className="w-full text-[11px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-muted px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-2 py-1">{children}</td>
  ),
  code(props) {
    const { className, children, node: _node, ...rest } = props as {
      className?: string;
      children?: React.ReactNode;
      node?: unknown;
    } & Record<string, unknown>;
    const text = String(children ?? "");
    const match = /language-([\w-]+)/.exec(className || "");
    const isBlock = text.includes("\n") || !!match;
    if (isBlock) {
      return <CodeBlock code={text.replace(/\n$/, "")} lang={match?.[1]} />;
    }
    return (
      <code
        {...rest}
        className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-primary"
      >
        {children}
      </code>
    );
  },
};

function PykoMessageImpl({ content, compact: _compact }: Props) {
  return (
    <div className="pyko-md space-y-0.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const PykoMessage = memo(PykoMessageImpl);
