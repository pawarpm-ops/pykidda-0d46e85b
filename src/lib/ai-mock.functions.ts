// AI Mock Test Creator — server functions.
// Admin-only: generate/save/publish. Student-facing: sanitized fetch + submit.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
      throw new Error("Provide a syllabus PDF or write custom instructions (min ~20 chars).");
    }

    const sys = `You are an expert Python examiner creating a mock test for college students.
Return ONLY a JSON object with this exact shape:
{
  "questions": [
    {
      "type": "mcq" | "tf" | "fill" | "short" | "code",
      "prompt": "string",
      "options": ["A","B","C","D"],
      "correct_answer": "string (for mcq: the exact option text; for tf: 'True' or 'False'; for fill/short: the accepted answer; for code: leave empty)",
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
- code: options empty; correct_answer empty; starter_code provided; 2-4 deterministic hidden test cases with exact expected stdout (no trailing newline).
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

    return { id: testId, total_marks: totalMarks, question_count: questionCount };
  });

// ----------- Publish / Unpublish / Delete -----------

export const publishAiMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), publish: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const patch: Record<string, unknown> = data.publish
      ? { status: "published", published_at: new Date().toISOString() }
      : { status: "draft" };
    const { error } = await supabaseAdmin.from("ai_mock_tests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAiMockTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const { error } = await supabaseAdmin.from("ai_mock_tests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };
    const { data: test, error: tErr } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("id,title,description,duration_sec,status,total_marks,question_count")
      .eq("id", data.id)
      .single();
    if (tErr) throw new Error(tErr.message);
    const t = test as { status: string };
    if (t.status !== "published") throw new Error("Test not available");

    const { data: qs, error: qErr } = await supabaseAdmin
      .from("ai_mock_questions")
      .select("id,order_index,type,prompt,options,starter_code,code_tests,marks")
      .eq("test_id", data.id)
      .order("order_index");
    if (qErr) throw new Error(qErr.message);
    return { test, questions: qs ?? [] };
  });

// ----------- Student: submit attempt (server-graded for non-code) -----------

const AnswerSchema = z.object({
  question_id: z.string().uuid(),
  response: z.string().max(20000).default(""),
  code_passed: z.number().int().min(0).optional(),
  code_total: z.number().int().min(0).optional(),
});

const SubmitInput = z.object({
  test_id: z.string().uuid(),
  submission_type: z.enum(["normal", "auto-violation"]).default("normal"),
  violation_reason: z.string().max(500).optional(),
  time_taken_sec: z.number().int().min(0),
  answers: z.array(AnswerSchema),
});

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
    let marksObtained = 0;
    let totalMarks = 0;
    const gradedAnswers = questions.map((q) => {
      totalMarks += q.marks;
      const a = answerMap.get(q.id);
      const response = a?.response ?? "";
      let awarded = 0;
      let correct = false;
      if (q.type === "code") {
        // Code is executed client-side (Pyodide). Validate the client-
        // reported pass counts against the actual number of hidden tests
        // stored on the question, and only award full marks when every
        // test passed. Mirrors practice-question grading.
        const tests = Array.isArray((q as any).code_tests) ? (q as any).code_tests : [];
        const total = tests.length;
        const passed = Math.min(a?.code_passed ?? 0, total);
        const reportedTotal = a?.code_total ?? 0;
        if (total > 0 && reportedTotal === total && passed === total) {
          awarded = q.marks;
          correct = true;
        }
      } else if (q.type === "mcq" || q.type === "tf" || q.type === "fill") {
        if (normalizeAnswer(response) === normalizeAnswer(q.correct_answer)) {
          awarded = q.marks;
          correct = true;
        }
      } else if (q.type === "short") {
        // Simple heuristic: award full marks if the model answer's key tokens appear.
        const key = normalizeAnswer(q.correct_answer);
        const resp = normalizeAnswer(response);
        if (key && resp && (resp.includes(key) || key.split(" ").every((tok) => tok.length < 3 || resp.includes(tok)))) {
          awarded = q.marks;
          correct = true;
        }
      }
      marksObtained += awarded;
      return {
        question_id: q.id,
        response,
        correct,
        marks_awarded: awarded,
        marks_total: q.marks,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        code_passed: a?.code_passed ?? null,
        code_total: a?.code_total ?? null,
      };
    });

    const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
    const grade = gradeFor(percentage);

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
        .select("id,title,description,status,duration_sec,total_marks,question_count,created_at,published_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return rows ?? [];
    }
    const { data: rows, error } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("id,title,description,status,duration_sec,total_marks,question_count,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
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
- Code questions: runnable on Pyodide (no file I/O, no matplotlib, no pandas). Deterministic hidden test cases with exact expected stdout.
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
    return { questions };
  });

