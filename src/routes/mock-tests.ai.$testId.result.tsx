// AI mock test — result page. Reads from sessionStorage (immediate) or fetches
// the attempt from server if the user navigates back later.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { MockAiCorrector } from "@/components/MockAiCorrector";
import { getAiMockAttemptResult } from "@/lib/ai-mock.functions";

const SearchSchema = z.object({ attempt: z.string().optional(), view: z.enum(["analyse"]).optional() });

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
  teacher_comment?: string | null;
};


type Result = {
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  answers: GradedAnswer[];
  grading_status?: string;
  teacher_feedback?: string | null;
  reviewed_at?: string | null;
};


type QuestionRow = {
  id: string;
  prompt: string;
  type: string;
  options: unknown;
  correct_answer: string;
  starter_code: string | null;
  explanation: string;
  order_index: number;
};

function ResultPage() {
  const { testId } = Route.useParams();
  const { attempt, view } = Route.useSearch();
  const [result, setResult] = useState<Result | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testKind, setTestKind] = useState<string>("");
  const [questions, setQuestions] = useState<Record<string, QuestionRow>>({});
  const [pendingReview, setPendingReview] = useState(false);

  useEffect(() => {
    (async () => {
      if (!attempt) return;
      const cached = sessionStorage.getItem(`pykidda:ai-mock-result:${attempt}`);
      if (cached) {
        try { setResult(JSON.parse(cached)); } catch { /* ignore */ }
      }
      try {
        const res = await getAiMockAttemptResult({ data: { attempt_id: attempt } });
        setResult(res.attempt as unknown as Result);
        setPendingReview(!!(res as { pending_review?: boolean }).pending_review);
        if (res.test) {
          setTestTitle((res.test as { title: string }).title);
          setTestKind((res.test as { test_kind?: string }).test_kind ?? "");
        }
        const map: Record<string, QuestionRow> = {};
        for (const q of res.questions as unknown as QuestionRow[]) map[q.id] = q;
        setQuestions(map);
      } catch (e) {
        console.error("Failed to load result", e);
      }
    })();
  }, [attempt, testId]);


  if (!result) return <div className="p-10 text-center">Loading result…</div>;

  const isPending = pendingReview || (result.grading_status && result.grading_status !== "published");

  if (isPending) {

    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-accent font-semibold">Answer Key</p>
          <h1 className="mt-1 text-3xl font-bold">{testTitle || "Scheduled Mock Test"}</h1>

          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <p className="text-lg font-semibold">📝 Your test has been submitted</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Scheduled mock tests are graded manually by your teacher. Marks, grade,
              and per-question feedback will appear here after the teacher publishes results.
              In the meantime, review the correct answer for every question below.
            </p>
          </div>

          <section className="mt-8 space-y-4">
            {result.answers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No questions to display.</p>
            ) : (
              <ol className="space-y-4">
                {result.answers.map((a, i) => (
                  <AnswerCard key={a.question_id} answer={a} question={questions[a.question_id]} index={i} tab="key" testTitle={testTitle} showAiExplain />
                ))}
              </ol>
            )}
          </section>

          <div className="mt-8 flex gap-3">
            <Link to="/mock-tests" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">Back to tests</Link>
            <Link to="/" className="rounded-md border border-border px-4 py-2 font-semibold">Home</Link>
          </div>
        </main>
      </div>
    );
  }


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
          {result.reviewed_at && (
            <p className="mt-2 text-xs text-muted-foreground">Reviewed by your teacher on {new Date(result.reviewed_at).toLocaleString()}</p>
          )}
        </div>

        {result.teacher_feedback && (
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">💬 Teacher's overall feedback</p>
            <p className="mt-2 text-sm whitespace-pre-wrap">{result.teacher_feedback}</p>
          </div>
        )}

        <AnswerTabs correct={correctAnswers} incorrect={incorrectAnswers} all={result.answers} questions={questions} answerKeyOnly={testKind === "scheduled"} testTitle={testTitle} showAiExplain={testKind === "scheduled"} graded={testKind === "scheduled"} />

        <div className="mt-8 flex gap-3">
          <Link to="/mock-tests" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">Back to tests</Link>
          <Link to="/" className="rounded-md border border-border px-4 py-2 font-semibold">Home</Link>
        </div>
      </main>
    </div>
  );
}


type TabKey = "correct" | "incorrect" | "key";

function AnswerTabs({ correct, incorrect, all, questions, answerKeyOnly = false, testTitle = "", showAiExplain = false, graded = false }: { correct: GradedAnswer[]; incorrect: GradedAnswer[]; all: GradedAnswer[]; questions: Record<string, QuestionRow>; answerKeyOnly?: boolean; testTitle?: string; showAiExplain?: boolean; graded?: boolean }) {
  const [tab, setTab] = useState<TabKey>(answerKeyOnly ? "key" : "correct");

  const tabs: { key: TabKey; label: string; count: number }[] = answerKeyOnly
    ? [{ key: "key", label: "Answer Key", count: all.length }]
    : [
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
        <ol className="mt-4 space-y-4">
          {list.map((a) => {
            const origIdx = all.indexOf(a);
            const q = questions[a.question_id];
            return (
              <AnswerCard
                key={a.question_id}
                answer={a}
                question={q}
                index={origIdx}
                tab={tab}
                testTitle={testTitle}
                showAiExplain={showAiExplain}
                graded={graded}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}

function AnswerCard({ answer: a, question: q, index, tab, testTitle = "", showAiExplain = false, graded = false }: { answer: GradedAnswer; question: QuestionRow | undefined; index: number; tab: TabKey; testTitle?: string; showAiExplain?: boolean; graded?: boolean }) {
  const isMcq = (q?.type ?? "").toLowerCase() === "mcq";
  const options = useMemo(() => {
    if (!q) return [] as string[];
    const raw = q.options;
    if (Array.isArray(raw)) return raw.map((o) => String(o));
    return [];
  }, [q]);

  const norm = (s: string) => s.trim().toLowerCase();
  const userAns = a.response ?? "";
  const correctAns = a.correct_answer ?? q?.correct_answer ?? "";

  return (
    <li
      className={`rounded-xl border-l-4 border border-border bg-card p-4 ${
        tab === "key"
          ? "border-l-primary"
          : a.correct
            ? "border-l-[oklch(0.65_0.16_145)]"
            : "border-l-destructive"
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-semibold text-sm">
          Q{index + 1}
          {q?.type ? <span className="ml-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{q.type}</span> : null}
          {graded && a.marks_total > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">· {a.marks_awarded}/{a.marks_total} marks</span>
          )}
          {!graded && !showAiExplain && tab !== "key" && (
            <span className="ml-2 text-muted-foreground font-normal">· {a.marks_awarded}/{a.marks_total} marks</span>
          )}
        </p>
        {graded && a.marks_total > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            💬 Teacher graded
          </span>
        )}
        {!graded && !showAiExplain && tab !== "key" && (
          <span
            className={`text-xs font-bold ${
              a.correct ? "text-[oklch(0.55_0.16_145)]" : "text-destructive"
            }`}
          >
            {a.correct ? "✓ Correct" : "✗ Incorrect"}
            {a.code_total !== null ? ` · ${a.code_passed}/${a.code_total} tests` : ""}
          </span>
        )}
      </div>

      {/* Full question text */}
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Question</p>
        <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">
          {q?.prompt ?? <span className="italic text-muted-foreground">(question not available)</span>}
        </p>
      </div>

      {/* MCQ options */}
      {isMcq && options.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Options</p>
          <ul className="mt-2 space-y-1.5">
            {options.map((opt, i) => {
              const isUser = norm(opt) === norm(userAns);
              const isCorrect = norm(opt) === norm(correctAns);
              const cls = isCorrect
                ? "border-[oklch(0.55_0.16_145)] bg-[oklch(0.65_0.16_145)]/10"
                : isUser
                  ? "border-destructive bg-destructive/10"
                  : "border-border bg-background";
              return (
                <li key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[11px] font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap">{opt}</span>
                  <span className="ml-2 flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {isUser && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isCorrect ? "bg-[oklch(0.55_0.16_145)] text-white" : "bg-destructive text-destructive-foreground"}`}>
                        Your pick
                      </span>
                    )}
                    {isCorrect && (
                      <span className="rounded bg-[oklch(0.55_0.16_145)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Correct
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Non-MCQ user answer + correct answer */}
      {!isMcq && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-secondary/30 p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Your answer</p>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-foreground">{userAns || "(blank)"}</pre>
          </div>
          <div className="rounded-md border border-[oklch(0.65_0.16_145)]/40 bg-[oklch(0.65_0.16_145)]/5 p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.16_145)]">Correct answer</p>
            {(() => {
              const isCode = (q?.type ?? "").toLowerCase() === "code";
              const codeSolution = correctAns || q?.starter_code || "";
              if (isCode && codeSolution) {
                return <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{codeSolution}</pre>;
              }
              return <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{correctAns || "(not provided)"}</pre>;
            })()}
          </div>
        </div>
      )}

      {/* MCQ still show a plain summary line for accessibility */}
      {isMcq && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Your answer:</span>{" "}
          <span className={a.correct ? "text-[oklch(0.45_0.16_145)]" : "text-destructive"}>{userAns || "(blank)"}</span>
          {" · "}
          <span className="font-semibold text-foreground">Correct:</span>{" "}
          <span className="text-[oklch(0.45_0.16_145)]">{correctAns || "(n/a)"}</span>
        </p>
      )}

      {!showAiExplain && (a.explanation || q?.explanation) && (
        <div className="mt-3 rounded-md border border-border bg-secondary/30 p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">💡 Explanation</p>
          <p className="mt-1 text-xs whitespace-pre-wrap">{a.explanation || q?.explanation}</p>
        </div>
      )}

      {a.teacher_comment && (
        <div className="mt-3 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">💬 Teacher's comment</p>
          <p className="mt-1 text-xs whitespace-pre-wrap">{a.teacher_comment}</p>
        </div>
      )}

      {showAiExplain && q && (
        <MockAiCorrector
          title={`${testTitle} · Q${index + 1}`}
          prompt={q.prompt ?? ""}
          userCode={a.response ?? ""}
          referenceSolution={a.correct_answer ?? q.correct_answer ?? ""}
          failingTests={[]}
        />
      )}
    </li>

  );
}
