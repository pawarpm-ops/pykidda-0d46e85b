// AI mock test — result page. Reads from sessionStorage (immediate) or fetches
// the attempt from server if the user navigates back later.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

const SearchSchema = z.object({ attempt: z.string().optional() });

export const Route = createFileRoute("/mock-tests/ai/$testId/result")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({ meta: [{ title: "Test result · PY Kidda" }, { name: "robots", content: "noindex" }] }),
  component: ResultPage,
  ssr: false,
});

type GradedAnswer = {
  question_id: string;
  response: string;
  correct: boolean;
  marks_awarded: number;
  marks_total: number;
  correct_answer: string;
  explanation: string;
  code_passed: number | null;
  code_total: number | null;
};

type Result = {
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  answers: GradedAnswer[];
};

function ResultPage() {
  const { testId } = Route.useParams();
  const { attempt } = Route.useSearch();
  const [result, setResult] = useState<Result | null>(null);
  const [testTitle, setTestTitle] = useState("");

  useEffect(() => {
    (async () => {
      if (attempt) {
        const cached = sessionStorage.getItem(`pykidda:ai-mock-result:${attempt}`);
        if (cached) {
          try {
            setResult(JSON.parse(cached));
          } catch { /* ignore */ }
        }
        const { data } = await supabase.from("ai_mock_attempts" as never).select("marks_obtained,total_marks,percentage,grade,answers").eq("id", attempt).maybeSingle();
        if (data) setResult(data as unknown as Result);
      }
      const { data: t } = await supabase.from("ai_mock_tests" as never).select("title").eq("id", testId).maybeSingle();
      if (t) setTestTitle((t as { title: string }).title);
    })();
  }, [attempt, testId]);

  if (!result) return <div className="p-10 text-center">Loading result…</div>;

  const gradeColor =
    result.percentage >= 80 ? "text-[oklch(0.55_0.16_145)]" :
    result.percentage >= 60 ? "text-primary" :
    result.percentage >= 40 ? "text-[oklch(0.65_0.16_85)]" : "text-destructive";

  const correctAnswers = result.answers.filter((a) => a.correct);
  const incorrectAnswers = result.answers.filter((a) => !a.correct);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold">Result</p>
        <h1 className="mt-1 text-3xl font-bold">{testTitle || "AI Mock Test"}</h1>

        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className={`text-6xl font-bold ${gradeColor}`}>{result.percentage}%</p>
          <p className="mt-2 text-lg">Grade <b>{result.grade}</b> · {result.marks_obtained} / {result.total_marks} marks</p>
        </div>

        <AnswerTabs correct={correctAnswers} incorrect={incorrectAnswers} all={result.answers} />

        <div className="mt-8 flex gap-3">
          <Link to="/mock-tests" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">Back to tests</Link>
          <Link to="/" className="rounded-md border border-border px-4 py-2 font-semibold">Home</Link>
        </div>
      </main>
    </div>
  );
}

type TabKey = "correct" | "incorrect" | "key";

function AnswerTabs({ correct, incorrect, all }: { correct: GradedAnswer[]; incorrect: GradedAnswer[]; all: GradedAnswer[] }) {
  const [tab, setTab] = useState<TabKey>("correct");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "correct", label: "Correct Questions", count: correct.length },
    { key: "incorrect", label: "Incorrect Questions", count: incorrect.length },
    { key: "key", label: "Answer Key", count: all.length },
  ];

  const list = tab === "correct" ? correct : tab === "incorrect" ? incorrect : all;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-md border-b-2 transition ${
              tab === t.key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground text-center py-8">
          {tab === "correct" ? "No correct answers yet." : tab === "incorrect" ? "No incorrect answers — great job!" : "No questions."}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {list.map((a) => {
            const origIdx = all.indexOf(a);
            return (
              <li
                key={a.question_id}
                className={`rounded-xl border-l-4 border border-border bg-card p-4 ${
                  tab === "key"
                    ? "border-l-primary"
                    : a.correct
                      ? "border-l-[oklch(0.65_0.16_145)]"
                      : "border-l-destructive"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-semibold text-sm">Q{origIdx + 1} · {a.marks_awarded}/{a.marks_total} marks</p>
                  {tab !== "key" && (
                    <span className={`text-xs font-bold ${a.correct ? "text-[oklch(0.55_0.16_145)]" : "text-destructive"}`}>
                      {a.correct ? "✓ Correct" : "✗ Incorrect"}
                      {a.code_total !== null ? ` · ${a.code_passed}/${a.code_total} tests` : ""}
                    </span>
                  )}
                </div>

                {tab === "correct" && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Your answer: </span>
                    <span className="font-mono whitespace-pre-wrap">{a.response || "(blank)"}</span>
                  </p>
                )}

                {tab === "incorrect" && (
                  <>
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">Your answer: </span>
                      <span className="font-mono whitespace-pre-wrap text-destructive">{a.response || "(blank)"}</span>
                    </p>
                    {a.correct_answer && (
                      <div className="mt-3 rounded-md border border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/5 p-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-[oklch(0.55_0.16_145)]">✨ AI Correct Solution</p>
                        <p className="mt-1 text-sm font-mono whitespace-pre-wrap">{a.correct_answer}</p>
                        {a.explanation && (
                          <p className="mt-2 text-xs text-muted-foreground italic">💡 {a.explanation}</p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {tab === "key" && (
                  <div className="mt-2 space-y-2">
                    {a.correct_answer && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Correct answer: </span>
                        <span className="font-mono whitespace-pre-wrap">{a.correct_answer}</span>
                      </p>
                    )}
                    {a.explanation && (
                      <p className="text-xs text-muted-foreground italic">💡 {a.explanation}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
