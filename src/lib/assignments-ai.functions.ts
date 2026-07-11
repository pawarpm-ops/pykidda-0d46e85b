// AI helpers for the Homework (assignments) module.
// - generateHomeworkQuestions: teacher inputs topic/count/difficulty → AI drafts N questions.
// - refineHomeworkQuestion: rewrites one existing assignment; returns before/after.
// Nothing is written to the DB from generation/refine — the client shows the
// draft, teacher accepts, then the existing admin create/update fns save.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const AI_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

type UserBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

async function callAi(system: string, user: string | UserBlock[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured on this project (missing LOVABLE_API_KEY).");
  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("AI is busy right now — please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings → Plans & credits.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI could not generate questions right now. (${res.status}) ${t.slice(0, 160)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJsonLoose<T = unknown>(s: string): T {
  try { return JSON.parse(s) as T; } catch { /* fall through */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI returned an unreadable response. Please try again.");
  return JSON.parse(m[0]) as T;
}

// -------- Generate --------

const ReferenceFileSchema = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  // base64-encoded file content, max ~8 MB after encoding
  data_base64: z.string().min(1).max(12_000_000),
});

const GenerateInput = z.object({
  topic: z.string().trim().min(1).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  count: z.number().int().min(1).max(10).default(3),
  marks_per_question: z.number().int().min(1).max(100).default(10),
  question_type: z.enum(["coding", "written", "mixed"]).default("coding"),
  instructions: z.string().max(4000).default(""),
  reference_file: ReferenceFileSchema.nullable().optional(),
});

const AiQuestionSchema = z.object({
  title: z.string().min(1),
  problem_statement: z.string().min(1),
  input_format: z.string().default(""),
  output_format: z.string().default(""),
  sample_input: z.string().default(""),
  sample_output: z.string().default(""),
  constraints: z.string().default(""),
  hints: z.string().default(""),
  starter_code: z.string().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  marks: z.number().int().min(1).max(100).default(10),
});
export type AiQuestion = z.infer<typeof AiQuestionSchema>;

export const generateHomeworkQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sys = `You are an expert Python teacher creating homework for engineering students.
Return ONLY a JSON object of this exact shape (no markdown, no prose):
{
  "questions": [
    {
      "title": "short title",
      "problem_statement": "clear multi-line problem description",
      "input_format": "how input is provided (may be empty)",
      "output_format": "expected output shape",
      "sample_input": "example input as it would be typed",
      "sample_output": "example output — no trailing newline",
      "constraints": "any bounds / rules",
      "hints": "brief teacher-only hint",
      "starter_code": "optional short Python skeleton with a TODO",
      "difficulty": "easy" | "medium" | "hard",
      "marks": integer
    }
  ]
}
Rules:
- Produce EXACTLY ${data.count} questions on the topic below.
- Difficulty should be around "${data.difficulty}" (mix is fine within one level).
- Each question ~${data.marks_per_question} marks.
- Question type preference: "${data.question_type}" (coding = require Python code, written = conceptual, mixed = either).
- All Python must run on plain CPython / Pyodide: no file I/O, no plotting, no pandas, no tkinter.
- Sample input/output must be exactly what a student would see/type.`;
    const user = `Topic: ${data.topic}
${data.instructions.trim() ? `Extra teacher instructions:\n"""\n${data.instructions.slice(0, 4000)}\n"""` : ""}`;
    const content = await callAi(sys, user);
    const parsed = parseJsonLoose<{ questions: unknown[] }>(content);
    const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions: AiQuestion[] = raw.map((q) => {
      const r = AiQuestionSchema.safeParse({
        marks: data.marks_per_question,
        difficulty: data.difficulty,
        ...(q as object),
      });
      if (r.success) return r.data;
      const asObj = (q as Record<string, unknown>) ?? {};
      return {
        title: String(asObj.title ?? "Untitled question"),
        problem_statement: String(asObj.problem_statement ?? asObj.prompt ?? ""),
        input_format: String(asObj.input_format ?? ""),
        output_format: String(asObj.output_format ?? ""),
        sample_input: String(asObj.sample_input ?? ""),
        sample_output: String(asObj.sample_output ?? ""),
        constraints: String(asObj.constraints ?? ""),
        hints: String(asObj.hints ?? ""),
        starter_code: String(asObj.starter_code ?? ""),
        difficulty: data.difficulty,
        marks: data.marks_per_question,
      };
    });
    if (questions.length === 0) {
      throw new Error("AI could not generate questions right now. Please try again.");
    }
    return { questions };
  });

// -------- Refine one existing assignment --------

const RefineInput = z.object({ id: z.string().uuid() });

export const refineHomeworkQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RefineInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: a, error } = await context.supabase
      .from("assignments")
      .select("id,title,description,input_format,output_format,sample_input,sample_output,constraints,hints,starter_code,instructions,difficulty,total_marks")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!a) throw new Error("Homework not found");

    const sys = `You are an expert Python teacher improving a homework question. Return ONLY JSON:
{
  "title": "...",
  "description": "improved problem statement",
  "input_format": "...",
  "output_format": "...",
  "sample_input": "...",
  "sample_output": "...",
  "constraints": "...",
  "hints": "...",
  "instructions": "clearer instructions for students",
  "starter_code": "..."
}
Improve clarity, grammar, tighten the problem statement, balance difficulty, and make sample I/O consistent. Preserve the original intent and difficulty. No markdown, no prose outside JSON.`;
    const user = `Current question:\n${JSON.stringify(a, null, 2)}`;
    const content = await callAi(sys, user);
    const after = parseJsonLoose<Record<string, string>>(content);
    // Normalize
    const clean = (k: string) => (typeof after[k] === "string" ? after[k] : (a as Record<string, unknown>)[k] as string ?? "");
    return {
      before: a,
      after: {
        title: clean("title") || a.title,
        description: clean("description"),
        input_format: clean("input_format"),
        output_format: clean("output_format"),
        sample_input: clean("sample_input"),
        sample_output: clean("sample_output"),
        constraints: clean("constraints"),
        hints: clean("hints"),
        instructions: clean("instructions"),
        starter_code: clean("starter_code"),
      },
    };
  });

// -------- Apply an accepted refinement --------

const ApplyInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    input_format: z.string().default(""),
    output_format: z.string().default(""),
    sample_input: z.string().default(""),
    sample_output: z.string().default(""),
    constraints: z.string().default(""),
    hints: z.string().default(""),
    instructions: z.string().default(""),
    starter_code: z.string().default(""),
  }),
});

export const applyHomeworkRefinement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApplyInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("assignments")
      .update({
        title: data.patch.title,
        description: data.patch.description,
        input_format: data.patch.input_format || null,
        output_format: data.patch.output_format || null,
        sample_input: data.patch.sample_input || null,
        sample_output: data.patch.sample_output || null,
        constraints: data.patch.constraints || null,
        hints: data.patch.hints || null,
        instructions: data.patch.instructions || null,
        starter_code: data.patch.starter_code || null,
        refined_by_ai: true,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Bulk save AI-generated draft questions as assignments --------

const SaveAiBatchInput = z.object({
  publish: z.boolean().default(false),
  due_at: z.string().nullable().optional(),
  submission_mode: z.enum(["submit", "self_solve"]).default("submit"),
  topic: z.string().max(200).default(""),
  questions: z.array(AiQuestionSchema).min(1).max(20),
});

export const saveAiGeneratedHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveAiBatchInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.submission_mode === "submit" && !data.due_at) {
      throw new Error("Due date is required for submit-mode homework.");
    }
    const rows = data.questions.map((q) => ({
      title: q.title.slice(0, 200),
      description: [
        q.problem_statement,
        q.input_format ? `\n\n**Input**\n${q.input_format}` : "",
        q.output_format ? `\n\n**Output**\n${q.output_format}` : "",
        q.constraints ? `\n\n**Constraints**\n${q.constraints}` : "",
      ].join(""),
      topic: data.topic || null,
      unit: null,
      difficulty: q.difficulty,
      assignment_type: q.starter_code ? "coding" : "written",
      total_marks: q.marks,
      due_at: data.submission_mode === "submit" ? data.due_at! : null,
      allow_late_submission: true,
      status: data.publish ? "published" : "draft",
      sample_input: q.sample_input || null,
      sample_output: q.sample_output || null,
      expected_output: q.sample_output || null,
      starter_code: q.starter_code || null,
      input_format: q.input_format || null,
      output_format: q.output_format || null,
      constraints: q.constraints || null,
      hints: q.hints || null,
      question_source: "ai_generated" as const,
      submission_mode: data.submission_mode,
      created_by: context.userId,
      ai_prompt_summary: data.topic || null,
    }));
    const { data: inserted, error } = await context.supabase
      .from("assignments")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    if (data.publish) {
      await context.supabase.from("announcements").insert({
        author_id: context.userId,
        title: "New homework assigned",
        body: `📝 ${rows.length} new homework question${rows.length === 1 ? "" : "s"} on "${data.topic || "Python"}". Open "Homework" to get started.`,
        priority: "normal",
      });
    }
    return { ids: (inserted ?? []).map((r: { id: string }) => r.id), count: rows.length };
  });
