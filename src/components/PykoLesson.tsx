import { memo, useState } from "react";
import {
  BookOpen,
  Lightbulb,
  ListChecks,
  Code2,
  Sparkles,
  AlertTriangle,
  Target,
  Rocket,
  ArrowRight,
} from "lucide-react";
import type { PykoLessonResponse } from "@/lib/pyko/lesson-schema";

type Props = {
  lesson: PykoLessonResponse;
  onSuggestion?: (prompt: string) => void;
};

const SECTION_ICON: Record<
  PykoLessonResponse["sections"][number]["type"],
  React.ComponentType<{ className?: string }>
> = {
  explanation: BookOpen,
  steps: ListChecks,
  syntax: Code2,
  example: Sparkles,
  analogy: Lightbulb,
  mistakes: AlertTriangle,
  tip: Target,
};

const DIFFICULTY_STYLES: Record<PykoLessonResponse["difficulty"], string> = {
  beginner: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  intermediate: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  advanced: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
};

function CodeCard({
  code,
  output,
  title,
  explanation,
}: {
  code: string;
  output?: string;
  title?: string;
  explanation?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-[hsl(220_18%_10%)] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
          <Code2 className="h-3 w-3" />
          {title || "python"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white/80 hover:bg-white/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5 text-[11px] leading-relaxed">
        <code className="font-mono text-slate-100">{code}</code>
      </pre>
      {output && (
        <div className="border-t border-white/10 bg-emerald-500/10 px-2.5 py-1.5">
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            Output
          </div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-100">
            <code className="font-mono">{output}</code>
          </pre>
        </div>
      )}
      {explanation && (
        <div className="border-t border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-white/80">
          {explanation}
        </div>
      )}
    </div>
  );
}

function PykoLessonImpl({ lesson, onSuggestion }: Props) {
  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80">
            {lesson.topic}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${DIFFICULTY_STYLES[lesson.difficulty]}`}
          >
            {lesson.difficulty}
          </span>
        </div>
        <h3 className="mt-1 text-sm font-bold leading-tight text-foreground">
          {lesson.title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {lesson.summary}
        </p>
      </div>

      {/* Sections */}
      {lesson.sections.map((s, i) => {
        const Icon = SECTION_ICON[s.type] ?? BookOpen;
        return (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-2.5 shadow-sm"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-3 w-3" />
              </span>
              <h4 className="text-xs font-bold text-foreground">{s.title}</h4>
            </div>
            {s.content && (
              <p className="text-xs leading-relaxed text-foreground/90">
                {s.content}
              </p>
            )}
            {s.points && s.points.length > 0 && (
              <ul
                className={`ml-4 space-y-0.5 text-xs text-foreground/90 ${
                  s.type === "steps" ? "list-decimal" : "list-disc"
                } marker:text-primary marker:font-semibold ${s.content ? "mt-1" : ""}`}
              >
                {s.points.map((p, j) => (
                  <li key={j} className="leading-relaxed">
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {/* Code examples */}
      {lesson.codeExamples && lesson.codeExamples.length > 0 && (
        <div className="space-y-1">
          {lesson.codeExamples.map((ex, i) => (
            <CodeCard
              key={i}
              title={ex.title}
              code={ex.code}
              output={ex.output}
              explanation={ex.explanation}
            />
          ))}
        </div>
      )}

      {/* Challenge */}
      {lesson.challenge && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300">
              <Rocket className="h-3 w-3" />
            </span>
            <h4 className="text-xs font-bold text-foreground">
              {lesson.challenge.title}
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-foreground/90">
            {lesson.challenge.instruction}
          </p>
          {lesson.challenge.hint && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              💡 {lesson.challenge.hint}
            </p>
          )}
          {lesson.challenge.starterCode && (
            <CodeCard title="Starter" code={lesson.challenge.starterCode} />
          )}
        </div>
      )}

      {/* Next steps */}
      {lesson.nextSteps && lesson.nextSteps.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Keep going
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lesson.nextSteps.map((n, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSuggestion?.(n.suggestedPrompt)}
                className="group inline-flex items-center gap-1 rounded-full border border-primary/30 bg-background px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-primary/10"
              >
                {n.label}
                <ArrowRight className="h-3 w-3 text-primary transition group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const PykoLesson = memo(PykoLessonImpl);
