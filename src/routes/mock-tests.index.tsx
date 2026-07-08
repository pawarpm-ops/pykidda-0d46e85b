import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { MOCK_TESTS, mockTestQuestions } from "@/lib/questions";
import { listAiMockTests } from "@/lib/ai-mock.functions";

export const Route = createFileRoute("/mock-tests/")({
  head: () => ({
    meta: [
      { title: "Mock Tests · PY Kidda" },
      { name: "description", content: "Take secure full-screen Python coding mock tests on PY Kidda." },
    ],
  }),
  component: MockTestsList,
  ssr: false,
});

type AiTestRow = {
  id: string;
  title: string;
  description: string;
  duration_sec: number;
  total_marks: number;
  question_count: number;
};

function MockTestsList() {
  const listFn = useServerFn(listAiMockTests);
  const [aiTests, setAiTests] = useState<AiTestRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const rows = await listFn({ data: { adminScope: false } });
        setAiTests(rows as AiTestRow[]);
      } catch {
        setAiTests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [listFn]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Exam mode</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Choose a mock test</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Use a laptop or desktop. Tests run in full-screen mode and{" "}
          <strong className="text-foreground">auto-submit if you exit</strong>. Coding questions are graded in your browser with real Python.
        </p>

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <span className="text-lg">📘</span>
            <h2 className="font-semibold">Available mock tests</h2>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading tests…</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {aiTests.map((t) => (
                <div
                  key={`ai-${t.id}`}
                  className="card-glow rounded-xl border border-border bg-card p-5 flex flex-col relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 rounded-bl-lg bg-[oklch(0.65_0.16_145)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                    AI
                  </div>
                  <h3 className="font-semibold text-lg pr-12">{t.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground flex-1">
                    {t.description || "AI-generated mock test."}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.question_count} Qs · {Math.round(t.duration_sec / 60)} min ·{" "}
                      {t.total_marks} marks
                    </span>
                    <Link
                      to="/mock-tests/ai/$testId/warning"
                      params={{ testId: t.id }}
                      className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                      style={{ backgroundImage: "var(--gradient-sunrise)" }}
                    >
                      Start
                    </Link>
                  </div>
                </div>
              ))}

              {MOCK_TESTS.map((t) => {
                const qs = mockTestQuestions(t);
                const marks = qs.reduce((a, q) => a + q.marks, 0);
                return (
                  <div key={t.id} className="card-glow rounded-xl border border-border bg-card p-5 flex flex-col">
                    <h3 className="font-semibold text-lg">{t.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground flex-1">{t.description}</p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {qs.length} Qs · {Math.round(t.durationSec / 60)} min · {marks} marks
                      </span>
                      <Link
                        to="/mock-tests/$testId/warning"
                        params={{ testId: t.id }}
                        className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)]"
                        style={{ backgroundImage: "var(--gradient-sunrise)" }}
                      >
                        Start
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
