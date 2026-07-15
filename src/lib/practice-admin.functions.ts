import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const TestCaseSchema = z.object({
  stdin: z.string().max(10000).optional().default(""),
  expected: z.string().max(10000),
  label: z.string().max(200).optional(),
});

const AiQuestionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(8000),
  starter_code: z.string().max(8000).optional().default(""),
  tests: z.array(TestCaseSchema).min(1).max(10),
  hint: z.string().max(2000).optional().default(""),
  solution: z.string().max(8000).optional().default(""),
});

const RefFileSchema = z
  .object({
    name: z.string().min(1).max(200),
    mime: z.string().min(1).max(200),
    data_url: z.string().min(1).max(9_000_000),
  })
  .nullable();

const GenerateInput = z.object({
  unit: z.number().int().min(1).max(20),
  count: z.number().int().min(1).max(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  instructions: z.string().max(4000).optional().default(""),
  publish: z.boolean().optional().default(false),
  marks: z.number().int().min(1).max(50).optional().default(4),
  reference_file: RefFileSchema.optional().default(null),
});

// ---------- Admin: list ----------
export const adminListPracticeQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await (context as Ctx).supabase
      .from("practice_questions")
      .select("id, unit, title, prompt, marks, status, difficulty, created_at, tests")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    type Row = {
      id: string;
      unit: number;
      title: string;
      prompt: string;
      marks: number;
      status: "draft" | "published";
      difficulty: string | null;
      created_at: string;
      tests: unknown[];
    };
    return (data ?? []).map((r: Row) => ({
      ...r,
      test_count: Array.isArray(r.tests) ? r.tests.length : 0,
    }));
  });

// ---------- Admin: delete ----------
export const adminDeletePracticeQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context as Ctx).supabase
      .from("practice_questions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: toggle publish ----------
export const adminSetPracticeQuestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context as Ctx).supabase
      .from("practice_questions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Student: list published ----------
export const listPublishedPracticeQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context as Ctx).supabase
      .from("practice_questions")
      .select("id, unit, title, prompt, starter_code, tests, hint, solution, marks")
      .eq("status", "published")
      .order("unit", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Student: fetch one published ----------
export const getPublishedPracticeQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context as Ctx).supabase
      .from("practice_questions")
      .select("id, unit, title, prompt, starter_code, tests, hint, solution, marks, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.status !== "published") throw new Error("Question not found");
    return row;
  });

// ---------- Admin: AI generation ----------
export const adminGeneratePracticeWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase, userId } = context as Ctx;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this project.");

    const ref = data.reference_file ?? null;
    const refNote = ref
      ? `\n- A reference file (${ref.name}) is attached. Base the questions on its content when relevant.`
      : "";

    const sys = `You are an expert Python teacher writing self-graded practice coding questions for engineering students.

Return ONLY a JSON object of this exact shape (no markdown, no commentary):
{
  "questions": [
    {
      "title": "short title (max 80 chars)",
      "prompt": "clear problem statement, may include input/output format and examples",
      "starter_code": "short Python skeleton with a TODO comment (may be empty string)",
      "tests": [
        { "stdin": "input as typed by the user", "expected": "exact expected stdout, no trailing newline", "label": "optional short label" }
      ],
      "hint": "one-line teacher hint",
      "solution": "a full working Python solution that passes every test"
    }
  ]
}

Strict rules:
- Produce EXACTLY ${data.count} coding question(s) for Unit ${data.unit}.
- Difficulty target: "${data.difficulty}".
- Every question MUST have between 3 and 5 deterministic tests.
- Code must run on plain CPython / Pyodide: no file I/O, no plotting, no pandas, no network, no input files.
- Use input() for stdin; use print() for stdout.
- The "expected" field must be exactly what print() would produce, with no extra spaces or trailing newline.
- The "solution" must be Python that, when fed each "stdin", prints the matching "expected".${refNote}`;

    const userText = `Unit: ${data.unit}
Difficulty: ${data.difficulty}
Count: ${data.count}
${data.instructions.trim() ? `Extra instructions:\n"""\n${data.instructions.slice(0, 4000)}\n"""` : ""}`;

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "file"; file: { filename: string; file_data: string } };

    let userContent: string | ContentBlock[] = userText;
    if (ref) {
      const blocks: ContentBlock[] = [{ type: "text", text: userText }];
      if (ref.mime.startsWith("image/")) {
        blocks.push({ type: "image_url", image_url: { url: ref.data_url } });
      } else if (ref.mime.startsWith("text/") || ref.mime === "application/json") {
        try {
          const b64 = ref.data_url.split(";base64,")[1] ?? "";
          const decoded = Buffer.from(b64, "base64").toString("utf8").slice(0, 60000);
          blocks.push({
            type: "text",
            text: `Reference file "${ref.name}":\n"""\n${decoded}\n"""`,
          });
        } catch {
          blocks.push({ type: "file", file: { filename: ref.name, file_data: ref.data_url } });
        }
      } else {
        blocks.push({ type: "file", file: { filename: ref.name, file_data: ref.data_url } });
      }
      userContent = blocks;
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("AI is busy right now — please try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Please top up in Settings → Plans & credits.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI could not generate practice questions. (${res.status}) ${t.slice(0, 160)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { questions?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned an unreadable response. Please try again.");
      parsed = JSON.parse(m[0]);
    }

    const rawQs = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rawQs
      .map((q) => {
        const r = AiQuestionSchema.safeParse(q);
        return r.success ? r.data : null;
      })
      .filter((q): q is z.infer<typeof AiQuestionSchema> => q !== null);

    if (questions.length === 0) {
      throw new Error("AI could not generate any valid questions. Please try again.");
    }

    const rows = questions.map((q) => ({
      unit: data.unit,
      title: q.title,
      prompt: q.prompt,
      starter_code: q.starter_code || "",
      tests: q.tests,
      hint: q.hint || null,
      solution: q.solution || null,
      marks: data.marks,
      difficulty: data.difficulty,
      status: data.publish ? "published" : "draft",
      created_by: userId,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("practice_questions")
      .insert(rows)
      .select("id");
    if (insErr) throw new Error(insErr.message);

    return { inserted: inserted?.length ?? 0, publish: data.publish };
  });
