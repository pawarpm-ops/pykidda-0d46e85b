// AI Mock Test Creator — server functions.
// Admin-only: generate/save/publish. Student-facing: sanitized fetch + submit.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAdminActivity } from "@/lib/audit-log.server";
import { z } from "zod";

const QuestionType = z.enum(["mcq", "tf", "fill", "short", "code"]);

const TestCaseSchema = z.object({
  stdin: z.string().default(""),
  expected: z.string(),
});

const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  order_index: z.number().int().min(0),
  type: QuestionType,
  prompt: z.string().min(1),
  options: z.array(z.string()).default([]),
  correct_answer: z.string().default(""),
  starter_code: z.string().default(""),
  code_tests: z.array(TestCaseSchema).default([]),
  marks: z.number().int().min(1).max(50).default(1),
  explanation: z.string().default(""),
});

async function assertAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

// ----------- Generate via Lovable AI (returns draft JSON, doesn't save) -----------

const GenerateInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  syllabusText: z.string().max(60000).default(""),
  customInstructions: z.string().max(4000).default(""),
  durationMinutes: z.number().int().min(5).max(240).default(30),
  counts: z.object({
    mcq: z.number().int().min(0).max(30).default(5),
    tf: z.number().int().min(0).max(20).default(3),
    fill: z.number().int().min(0).max(20).default(2),
    short: z.number().int().min(0).max(10).default(1),
    code: z.number().int().min(0).max(10).default(2),
  }),
});


export const generateAiMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const totalRequested = data.counts.mcq + data.counts.tf + data.counts.fill + data.counts.short + data.counts.code;
    if (totalRequested === 0) throw new Error("Ask for at least 1 question");
    if (data.syllabusText.trim().length < 20 && data.customInstructions.trim().length < 20) {
      throw new Error("Upload a syllabus PDF (or write custom instructions ~20+ chars) so the AI has something to build the test from.");
    }

    const sys = `You are an expert Python examiner creating a mock test for college students.
Return ONLY a JSON object with this exact shape:
{
  "questions": [
    {
      "type": "mcq" | "tf" | "fill" | "short" | "code",
      "prompt": "string",
      "options": ["A","B","C","D"],
      "correct_answer": "string (for mcq: the exact option text; for tf: 'True' or 'False'; for fill/short: the accepted answer; for code: a complete, correct reference Python solution that passes ALL the code_tests)",
      "starter_code": "string (only for code type; a short Python skeleton with a TODO comment)",
      "code_tests": [{"stdin":"...","expected":"..."}],
      "marks": integer,
      "explanation": "brief 1-2 sentence explanation"
    }
  ]
}

Rules:
- Produce EXACTLY: ${data.counts.mcq} mcq, ${data.counts.tf} tf, ${data.counts.fill} fill, ${data.counts.short} short, ${data.counts.code} code questions — in that order.
- mcq: 4 distinct options; correct_answer is the exact string of the right option.
- tf: options empty; correct_answer is "True" or "False".
- fill: options empty; correct_answer is the concise expected fill-in.
- short: options empty; correct_answer is a short model answer.
- code: options empty; starter_code provided; 2-4 deterministic hidden test cases with exact expected stdout (no trailing newline); correct_answer MUST be a complete runnable Python program (the reference solution) that passes every listed code_test — no markdown fences, just raw Python source.
- All Python code must run on plain CPython (Pyodide). No file I/O, no plotting, no tkinter, no pandas, no seaborn, no matplotlib, no external files.
- Marks: mcq/tf/fill=1, short=2, code=5 (adjust up to 10 for harder code).
- If a syllabus is provided, questions must be answerable from that syllabus content.
- Strictly follow any teacher instructions given below (difficulty, topics, style, tone, real-world context, etc.).
- No markdown fences. No prose. Just JSON.`;

    const user = `Test title: ${data.title}
Description: ${data.description}

${data.customInstructions.trim() ? `Teacher's custom instructions (highest priority — follow exactly):\n"""\n${data.customInstructions.slice(0, 4000)}\n"""\n` : ""}
${data.syllabusText.trim() ? `Syllabus text (extracted from PDF):\n"""\n${data.syllabusText.slice(0, 55000)}\n"""` : "No syllabus PDF provided — build the test purely from the teacher's instructions above."}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings → Plans & credits.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI request failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { questions: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned unparseable response.");
      parsed = JSON.parse(m[0]);
    }
    const rawQs = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rawQs.map((q, i) => {
      const parsedQ = QuestionSchema.safeParse({
        ...(q as object),
        order_index: i,
      });
      if (!parsedQ.success) {
        return {
          order_index: i,
          type: "short" as const,
          prompt: (q as { prompt?: string })?.prompt ?? "Question",
          options: [],
          correct_answer: "",
          starter_code: "",
          code_tests: [],
          marks: 1,
          explanation: "",
        };
      }
      return parsedQ.data;
    });

    await logAdminActivity(context.supabase, {
      actionType: "ai.mock_generated",
      description: `Used AI to generate mock test: ${data.title}`,
      moduleName: "ai",
      targetTitle: data.title,
      metadata: { question_count: questions.length, requested: data.counts },
    });

    return {
      title: data.title,
      description: data.description,
      duration_sec: data.durationMinutes * 60,
      questions,
    };
  });

// ----------- Save (create or replace draft) -----------

const SaveInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  syllabus_snippet: z.string().max(2000).default(""),
  duration_sec: z.number().int().min(60).max(60 * 60 * 4),
  questions: z.array(QuestionSchema).min(1),
});

export const saveAiMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };

    const totalMarks = data.questions.reduce((a, q) => a + q.marks, 0);
    const questionCount = data.questions.length;

    let testId = data.id;
    if (testId) {
      const { error: uErr } = await supabaseAdmin
        .from("ai_mock_tests")
        .update({
          title: data.title,
          description: data.description,
          syllabus_snippet: data.syllabus_snippet,
          duration_sec: data.duration_sec,
          total_marks: totalMarks,
          question_count: questionCount,
        })
        .eq("id", testId);
      if (uErr) throw new Error(uErr.message);
      await supabaseAdmin.from("ai_mock_questions").delete().eq("test_id", testId);
    } else {
      const { data: inserted, error: iErr } = await supabaseAdmin
        .from("ai_mock_tests")
        .insert({
          admin_id: context.userId,
          title: data.title,
          description: data.description,
          syllabus_snippet: data.syllabus_snippet,
          duration_sec: data.duration_sec,
          total_marks: totalMarks,
          question_count: questionCount,
          status: "draft",
        })
        .select("id")
        .single();
      if (iErr) throw new Error(iErr.message);
      testId = (inserted as { id: string }).id;
    }

    const rows = data.questions.map((q, i) => ({
      test_id: testId,
      order_index: i,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      starter_code: q.starter_code,
      code_tests: q.code_tests,
      marks: q.marks,
      explanation: q.explanation,
    }));
    const { error: qErr } = await supabaseAdmin.from("ai_mock_questions").insert(rows);
    if (qErr) throw new Error(qErr.message);

    await logAdminActivity(context.supabase, {
      actionType: data.id ? "mock_test.updated" : "mock_test.created",
      description: data.id
        ? `Updated mock test: ${data.title}`
        : `Created mock test: ${data.title}`,
      moduleName: "mock_test",
      targetId: testId,
      targetTitle: data.title,
      newValue: { total_marks: totalMarks, question_count: questionCount },
    });

    return { id: testId, total_marks: totalMarks, question_count: questionCount };
  });

// ----------- Publish / Unpublish / Delete -----------

const PublishInput = z.object({
  id: z.string().uuid(),
  publish: z.boolean(),
  test_kind: z.enum(["normal", "scheduled"]).default("normal"),
  scheduled_start_at: z.string().datetime().optional().nullable(),
  scheduled_end_at: z.string().datetime().optional().nullable(),
  schedule_instructions: z.string().max(4000).default(""),
  results_visibility: z.enum(["immediate", "after_end"]).default("immediate"),
});

export const publishAiMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PublishInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    let patch: Record<string, unknown>;
    if (!data.publish) {
      patch = { status: "draft" };
    } else if (data.test_kind === "scheduled") {
      if (!data.scheduled_start_at || !data.scheduled_end_at) {
        throw new Error("Scheduled tests require start and end times");
      }
      const start = new Date(data.scheduled_start_at).getTime();
      const end = new Date(data.scheduled_end_at).getTime();
      if (!(end > start)) throw new Error("End time must be after start time");
      patch = {
        status: "published",
        published_at: new Date().toISOString(),
        test_kind: "scheduled",
        scheduled_start_at: data.scheduled_start_at,
        scheduled_end_at: data.scheduled_end_at,
        schedule_instructions: data.schedule_instructions,
        results_visibility: data.results_visibility,
      };
    } else {
      patch = {
        status: "published",
        published_at: new Date().toISOString(),
        test_kind: "normal",
        scheduled_start_at: null,
        scheduled_end_at: null,
        schedule_instructions: "",
        results_visibility: "immediate",
      };
    }
    const { data: updated, error } = await supabaseAdmin
      .from("ai_mock_tests")
      .update(patch)
      .eq("id", data.id)
      .select("id,title,scheduled_start_at,scheduled_end_at,test_kind")
      .single();
    if (error) throw new Error(error.message);

    // Broadcast a notification with a deep link when scheduling
    if (data.publish && data.test_kind === "scheduled") {
      const t = updated as { title: string; scheduled_start_at: string; scheduled_end_at: string };
      const startFmt = new Date(t.scheduled_start_at).toLocaleString();
      const endFmt = new Date(t.scheduled_end_at).toLocaleString();
      await supabaseAdmin.from("announcements").insert({
        author_id: context.userId,
        title: "New Scheduled Mock Test",
        body: `"${t.title}" is scheduled from ${startFmt} to ${endFmt}. Click View to see details.`,
        priority: "high",
        action_url: `/mock-tests/scheduled/${data.id}`,
      });
    } else if (data.publish) {
      const t = updated as { title?: string } | null;
      await supabaseAdmin.from("announcements").insert({
        author_id: context.userId,
        title: "New Mock Test available",
        body: `A new mock test "${t?.title ?? ""}" is now available. Click View to attempt it.`,
        priority: "normal",
        action_url: `/mock-tests`,
      });
    }
    const publishedTitle =
      (updated as { title?: string } | null)?.title ?? "";
    await logAdminActivity(context.supabase, {
      actionType: data.publish
        ? data.test_kind === "scheduled"
          ? "mock_test.scheduled_published"
          : "mock_test.published"
        : "mock_test.unpublished",
      description: data.publish
        ? data.test_kind === "scheduled"
          ? `Published scheduled mock test: ${publishedTitle}`
          : `Published mock test: ${publishedTitle}`
        : `Unpublished mock test: ${publishedTitle}`,
      moduleName: "mock_test",
      targetId: data.id,
      targetTitle: publishedTitle,
      newValue: patch,
    });
    return { ok: true };
  });

const UpdateScheduleInput = z.object({
  id: z.string().uuid(),
  scheduled_start_at: z.string().datetime(),
  scheduled_end_at: z.string().datetime(),
  schedule_instructions: z.string().max(4000).default(""),
  results_visibility: z.enum(["immediate", "after_end"]).default("immediate"),
});

export const updateAiMockSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateScheduleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const start = new Date(data.scheduled_start_at).getTime();
    const end = new Date(data.scheduled_end_at).getTime();
    if (!(end > start)) throw new Error("End time must be after start time");
    const { data: before } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("title, scheduled_start_at, scheduled_end_at, schedule_instructions, results_visibility")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("ai_mock_tests")
      .update({
        test_kind: "scheduled",
        scheduled_start_at: data.scheduled_start_at,
        scheduled_end_at: data.scheduled_end_at,
        schedule_instructions: data.schedule_instructions,
        results_visibility: data.results_visibility,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminActivity(context.supabase, {
      actionType: "mock_test.schedule_updated",
      description: `Changed schedule for mock test: ${before?.title ?? data.id}`,
      moduleName: "mock_test",
      targetId: data.id,
      targetTitle: before?.title ?? null,
      oldValue: before,
      newValue: {
        scheduled_start_at: data.scheduled_start_at,
        scheduled_end_at: data.scheduled_end_at,
        schedule_instructions: data.schedule_instructions,
        results_visibility: data.results_visibility,
      },
    });
    return { ok: true };
  });


export const deleteAiMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const { data: before } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("title")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("ai_mock_tests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminActivity(context.supabase, {
      actionType: "mock_test.deleted",
      description: `Deleted mock test: ${before?.title ?? data.id}`,
      moduleName: "mock_test",
      targetId: data.id,
      targetTitle: before?.title ?? null,
      oldValue: before,
    });
    return { ok: true };
  });

// ----------- Admin: get full test with answers (for editing) -----------

export const getAdminAiTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const { data: test, error: tErr } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (tErr) throw new Error(tErr.message);
    const { data: qs, error: qErr } = await supabaseAdmin
      .from("ai_mock_questions")
      .select("*")
      .eq("test_id", data.id)
      .order("order_index");
    if (qErr) throw new Error(qErr.message);
    return { test, questions: qs ?? [] };
  });

// ----------- Student: get sanitized test (no correct_answer/explanation) -----------

export const getStudentAiTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const { data: test, error: tErr } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("id,title,description,duration_sec,status,total_marks,question_count,test_kind,scheduled_start_at,scheduled_end_at,schedule_instructions,results_visibility")
      .eq("id", data.id)
      .single();
    if (tErr) throw new Error(tErr.message);
    const t = test as {
      status: string;
      test_kind?: string;
      scheduled_start_at?: string | null;
      scheduled_end_at?: string | null;
    };
    if (t.status !== "published") throw new Error("Test not available");
    if (t.test_kind === "scheduled") {
      const now = Date.now();
      if (!t.scheduled_start_at || !t.scheduled_end_at) throw new Error("Scheduled test is misconfigured");
      if (now < new Date(t.scheduled_start_at).getTime()) throw new Error("Scheduled test has not started yet");
      if (now > new Date(t.scheduled_end_at).getTime()) throw new Error("Scheduled test window has ended");
    }
    // One attempt per mock test (any kind) — block reopening the take screen.
    {
      const { data: prior } = await supabaseAdmin
        .from("ai_mock_attempts")
        .select("id")
        .eq("test_id", data.id)
        .eq("user_id", context.userId)
        .not("submitted_at", "is", null)
        .limit(1);
      if (Array.isArray(prior) && prior.length > 0) {
        throw new Error("You have already submitted this mock test. Only one attempt is allowed.");
      }
    }


    const { data: qs, error: qErr } = await supabaseAdmin
      .from("ai_mock_questions")
      .select("id,order_index,type,prompt,options,starter_code,code_tests,marks")
      .eq("test_id", data.id)
      .order("order_index");
    if (qErr) throw new Error(qErr.message);
    return { test, questions: qs ?? [] };
  });


// ----------- Student: submit attempt (server-graded for non-code) -----------

const CodeRunSchema = z.object({
  stdin: z.string().max(200_000).default(""),
  stdout: z.string().max(200_000).default(""),
  stderr: z.string().max(200_000).optional().default(""),
  ok: z.boolean().default(false),
});

const AnswerSchema = z.object({
  question_id: z.string().uuid(),
  response: z.string().max(200_000).default(""),
  // For code questions: student-submitted runs (one per server-held stdin;
  // server binds by stdin match). Client-reported pass/total counts are
  // IGNORED — the server re-diffs stdout against the server-held expected.
  runs: z.array(CodeRunSchema).max(50).optional(),
});

const SubmitInput = z.object({
  test_id: z.string().uuid(),
  submission_type: z.enum(["normal", "auto-violation"]).default("normal"),
  violation_reason: z.string().max(500).optional(),
  time_taken_sec: z.number().int().min(0),
  answers: z.array(AnswerSchema),
});

function normalizeOutput(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeFor(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

export const submitAiMockAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    // Time-gate scheduled tests server-side (source of truth)
    const { data: tRow } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("test_kind,scheduled_start_at,scheduled_end_at,status")
      .eq("id", data.test_id)
      .single();
    const isScheduled = tRow && (tRow as any).test_kind === "scheduled";
    if (isScheduled) {
      const now = Date.now();
      const s = (tRow as any).scheduled_start_at ? new Date((tRow as any).scheduled_start_at).getTime() : 0;
      const e = (tRow as any).scheduled_end_at ? new Date((tRow as any).scheduled_end_at).getTime() : 0;
      if (!s || !e) throw new Error("Scheduled test is misconfigured");
      // Allow a small grace window on submit (in case fullscreen exit fires right at end)
      if (now < s) throw new Error("Scheduled test has not started yet");
      if (now > e + 60_000) throw new Error("Scheduled test window has ended");
      // Enforce one attempt per student for scheduled tests.
      const { data: prior } = await supabaseAdmin
        .from("ai_mock_attempts")
        .select("id")
        .eq("test_id", data.test_id)
        .eq("user_id", context.userId)
        .not("submitted_at", "is", null)
        .limit(1);
      if (Array.isArray(prior) && prior.length > 0) {
        throw new Error("You have already submitted this scheduled test. Only one attempt is allowed.");
      }
    }
    const { data: qs, error: qErr } = await supabaseAdmin
      .from("ai_mock_questions")
      .select("*")
      .eq("test_id", data.test_id)
      .order("order_index");
    if (qErr) throw new Error(qErr.message);

    const questions = (qs ?? []) as Array<{
      id: string;
      type: "mcq" | "tf" | "fill" | "short" | "code";
      correct_answer: string;
      marks: number;
      explanation: string;
      prompt: string;
    }>;

    const answerMap = new Map(data.answers.map((a) => [a.question_id, a]));
    let autoMarks = 0;
    let totalMarks = 0;
    const gradedAnswers = questions.map((q) => {
      totalMarks += q.marks;
      const a = answerMap.get(q.id);
      const response = a?.response ?? "";
      let awarded = 0;
      let correct = false;
      let codePassed: number | null = null;
      let codeTotal: number | null = null;

      // Scheduled tests are graded manually by the teacher — no auto-grading
      // is performed on submit. We just capture the student's response and
      // keep the correct answer available for the answer-key view.
      if (!isScheduled) {
        if (q.type === "code") {
          const tests = Array.isArray((q as any).code_tests) ? (q as any).code_tests : [];
          const total = tests.length;
          const runs = a?.runs ?? [];
          let passed = 0;
          for (const tc of tests as Array<{ stdin: string; expected: string }>) {
            const run = runs.find(
              (r) => normalizeOutput(r.stdin ?? "") === normalizeOutput(tc.stdin ?? ""),
            );
            if (!run || !run.ok) continue;
            if (normalizeOutput(run.stdout ?? "") === normalizeOutput(tc.expected ?? "")) {
              passed++;
            }
          }
          if (total > 0) {
            const ratio = passed / total;
            awarded = Math.min(q.marks, Math.round(ratio * q.marks * 2) / 2);
            correct = passed === total;
          }
          codePassed = passed;
          codeTotal = total;
        } else if (q.type === "mcq" || q.type === "tf" || q.type === "fill") {
          if (normalizeAnswer(response) === normalizeAnswer(q.correct_answer)) {
            awarded = q.marks;
            correct = true;
          }
        } else if (q.type === "short") {
          const key = normalizeAnswer(q.correct_answer);
          const resp = normalizeAnswer(response);
          if (key && resp && (resp.includes(key) || key.split(" ").every((tok) => tok.length < 3 || resp.includes(tok)))) {
            awarded = q.marks;
            correct = true;
          }
        }
      }
      autoMarks += awarded;
      return {
        question_id: q.id,
        response,
        correct,
        marks_awarded: awarded,
        auto_marks_awarded: awarded,
        marks_total: q.marks,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        teacher_comment: "",
        code_passed: codePassed,
        code_total: codeTotal,
      };
    });


    const autoPercentage = totalMarks > 0 ? Math.round((autoMarks / totalMarks) * 100) : 0;

    // Scheduled tests wait for the teacher. Students see "Awaiting review"
    // and nothing counts toward the leaderboard until published.
    const marksObtained = isScheduled ? 0 : autoMarks;
    const percentage = isScheduled ? 0 : autoPercentage;
    const grade = isScheduled ? "-" : gradeFor(autoPercentage);
    const gradingStatus = isScheduled ? "pending_review" : "published";

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("ai_mock_attempts")
      .insert({
        user_id: context.userId,
        test_id: data.test_id,
        submitted_at: new Date().toISOString(),
        submission_type: data.submission_type,
        violation_reason: data.violation_reason ?? null,
        marks_obtained: marksObtained,
        total_marks: totalMarks,
        percentage,
        grade,
        time_taken_sec: data.time_taken_sec,
        answers: gradedAnswers,
        auto_marks_obtained: autoMarks,
        auto_percentage: autoPercentage,
        grading_status: gradingStatus,
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);

    return {
      attempt_id: (inserted as { id: string }).id,
      marks_obtained: marksObtained,
      total_marks: totalMarks,
      percentage,
      grade,
      answers: gradedAnswers,
      grading_status: gradingStatus,
    };
  });


// ----------- List tests (admin: all; students: published) -----------

export const listAiMockTests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ adminScope: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    if (data.adminScope) {
      await assertAdmin(context);
      const { data: rows, error } = await supabaseAdmin
        .from("ai_mock_tests")
        .select("id,title,description,status,duration_sec,total_marks,question_count,created_at,published_at,test_kind,scheduled_start_at,scheduled_end_at,schedule_instructions,results_visibility")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return rows ?? [];
    }
    const { data: rows, error } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("id,title,description,status,duration_sec,total_marks,question_count,published_at,test_kind,scheduled_start_at,scheduled_end_at,schedule_instructions,results_visibility")

      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ----------- Get attempt result with full questions (for result page) -----------

export const getAiMockAttemptResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const { data: attempt, error: aErr } = await supabaseAdmin
      .from("ai_mock_attempts")
      .select("id,user_id,test_id,marks_obtained,total_marks,percentage,grade,answers,submission_type,violation_reason,time_taken_sec,grading_status,teacher_feedback,reviewed_at")
      .eq("id", data.attempt_id)
      .single();
    if (aErr) throw new Error(aErr.message);
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (attempt.user_id !== context.userId && !isAdmin) throw new Error("Not authorized");
    const { data: test } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("id,title,test_kind")
      .eq("id", attempt.test_id)
      .single();

    // Student view: if scheduled and not yet published, strip grading data
    // (marks / correctness) but expose the answer key so students can review
    // the correct answer of every question while waiting for the teacher.
    const isOwnerNotAdmin = attempt.user_id === context.userId && !isAdmin;
    const pending = attempt.grading_status !== "published";
    const { data: questions, error: qErr } = await supabaseAdmin
      .from("ai_mock_questions")
      .select("id,prompt,type,options,correct_answer,starter_code,explanation,order_index")
      .eq("test_id", attempt.test_id)
      .order("order_index");
    if (qErr) throw new Error(qErr.message);

    if (isOwnerNotAdmin && pending) {
      const sanitizedAnswers = Array.isArray(attempt.answers)
        ? (attempt.answers as any[]).map((a) => ({
            question_id: a.question_id,
            response: a.response ?? "",
            correct: false,
            marks_awarded: 0,
            marks_total: a.marks_total ?? 0,
            correct_answer: a.correct_answer ?? "",
            explanation: a.explanation ?? "",
            code_passed: null,
            code_total: null,
            teacher_comment: null,
          }))
        : [];
      return {
        attempt: {
          ...attempt,
          marks_obtained: 0,
          percentage: 0,
          grade: "-",
          answers: sanitizedAnswers,
          teacher_feedback: null,
        },
        test,
        questions: questions ?? [],
        pending_review: true,
      };
    }

    return { attempt, test, questions: questions ?? [], pending_review: false };

  });


// ----------- List my attempts for a given AI mock test -----------

export const listMyAiMockAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ test_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const { data: rows, error } = await supabaseAdmin
      .from("ai_mock_attempts")
      .select("id,submitted_at,started_at,marks_obtained,total_marks,percentage,grade,submission_type,time_taken_sec,grading_status")
      .eq("test_id", data.test_id)
      .eq("user_id", context.userId)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ----------- Refine existing draft with AI chat instruction -----------

const RefineInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  instruction: z.string().min(3).max(4000),
  syllabusText: z.string().max(60000).default(""),
  questions: z.array(QuestionSchema).min(1),
});

export const refineAiMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RefineInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const sys = `You are an expert Python examiner refining an existing mock test based on a teacher's instruction.
Return ONLY a JSON object of the form: { "questions": [...] } using the SAME question schema as before:
{ type: "mcq"|"tf"|"fill"|"short"|"code", prompt, options[], correct_answer, starter_code, code_tests[{stdin,expected}], marks, explanation }.

Rules:
- Apply the teacher's instruction faithfully (add / remove / rewrite / change difficulty / swap topics / fix answers / etc.).
- Preserve unrelated questions unchanged.
- Keep answer keys consistent with prompts. Never expose answers inside prompts.
- Code questions: runnable on Pyodide (no file I/O, no matplotlib, no pandas). Deterministic hidden test cases with exact expected stdout. correct_answer MUST be a complete runnable Python reference solution that passes every code_test (raw source, no markdown fences).
- Return the FULL updated question list, not just the diff. No markdown fences. No prose.`;

    const user = `Test title: ${data.title}
Description: ${data.description}

Teacher's refinement instruction:
"""
${data.instruction}
"""

${data.syllabusText.trim() ? `Reference syllabus (for grounding):\n"""\n${data.syllabusText.slice(0, 40000)}\n"""\n` : ""}
Current questions (JSON):
${JSON.stringify(data.questions, null, 2).slice(0, 60000)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings → Plans & credits.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI request failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { questions: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned unparseable response.");
      parsed = JSON.parse(m[0]);
    }
    const rawQs = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rawQs.map((q, i) => {
      const parsedQ = QuestionSchema.safeParse({ ...(q as object), order_index: i });
      if (!parsedQ.success) {
        return {
          order_index: i,
          type: "short" as const,
          prompt: (q as { prompt?: string })?.prompt ?? "Question",
          options: [],
          correct_answer: "",
          starter_code: "",
          code_tests: [],
          marks: 1,
          explanation: "",
        };
      }
      return parsedQ.data;
    });
    await logAdminActivity(context.supabase, {
      actionType: "ai.mock_refined",
      description: `Used AI to refine mock test: ${data.title}`,
      moduleName: "ai",
      targetTitle: data.title,
      metadata: { instruction: data.instruction.slice(0, 500) },
    });
    return { questions };
  });

