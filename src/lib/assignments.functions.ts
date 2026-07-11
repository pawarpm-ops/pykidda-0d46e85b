import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

// ---------- Student ----------

export const listStudentAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: assignments, error } = await supabase
      .from("assignments")
      .select(
        "id, title, description, unit, topic, difficulty, assignment_type, total_marks, due_at, allow_late_submission, status, sample_input, sample_output, starter_code, created_at",
      )
      .in("status", ["published", "closed"])
      .order("due_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: subs, error: subErr } = await supabase
      .from("assignment_submissions")
      .select(
        "id, assignment_id, status, submitted_at, is_late, marks_obtained, teacher_feedback, reviewed_at",
      )
      .eq("student_id", userId);
    if (subErr) throw new Error(subErr.message);

    const byAssignment = new Map((subs ?? []).map((s: any) => [s.assignment_id, s]));
    return (assignments ?? []).map((a: any) => ({
      ...a,
      submission: byAssignment.get(a.id) ?? null,
    }));
  });

export const getStudentAssignment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: a, error } = await supabase
      .from("assignments")
      .select(
        "id, title, description, unit, topic, difficulty, assignment_type, total_marks, due_at, allow_late_submission, status, sample_input, sample_output, starter_code",
      )
      .eq("id", data.id)
      .in("status", ["published", "closed"])
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!a) throw new Error("Assignment not found");

    const { data: sub, error: subErr } = await supabase
      .from("assignment_submissions")
      .select(
        "id, answer_text, code_answer, code_output, status, submitted_at, is_late, marks_obtained, teacher_feedback, reviewed_at",
      )
      .eq("assignment_id", data.id)
      .eq("student_id", userId)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    return { assignment: a, submission: sub ?? null };
  });

const DraftSchema = z.object({
  assignment_id: z.string().uuid(),
  answer_text: z.string().max(20000).optional().nullable(),
  code_answer: z.string().max(50000).optional().nullable(),
  code_output: z.string().max(20000).optional().nullable(),
});

export const saveDraftSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DraftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("assignment_submissions")
      .select("id, status")
      .eq("assignment_id", data.assignment_id)
      .eq("student_id", userId)
      .maybeSingle();

    if (existing && existing.status === "reviewed") {
      throw new Error("Submission already reviewed, cannot edit");
    }

    if (existing) {
      const { error } = await supabase
        .from("assignment_submissions")
        .update({
          answer_text: data.answer_text ?? null,
          code_answer: data.code_answer ?? null,
          code_output: data.code_output ?? null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: inserted, error } = await supabase
      .from("assignment_submissions")
      .insert({
        assignment_id: data.assignment_id,
        student_id: userId,
        answer_text: data.answer_text ?? null,
        code_answer: data.code_answer ?? null,
        code_output: data.code_output ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const submitAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DraftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: a, error: aErr } = await supabase
      .from("assignments")
      .select("id, due_at, status, assignment_type, total_marks, expected_output, sample_input, sample_output, title, description")
      .eq("id", data.assignment_id)
      .in("status", ["published", "closed"])
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!a) throw new Error("Assignment not found");

    const now = new Date();
    const isLate = a.due_at ? now > new Date(a.due_at) : false;
    // Late submissions are always allowed — they are just flagged as late.


    const payload = {
      answer_text: data.answer_text ?? null,
      code_answer: data.code_answer ?? null,
      code_output: data.code_output ?? null,
      status: isLate ? "late" : "submitted",
      submitted_at: now.toISOString(),
      is_late: isLate,
    };

    const { data: existing } = await supabase
      .from("assignment_submissions")
      .select("id, status")
      .eq("assignment_id", data.assignment_id)
      .eq("student_id", userId)
      .maybeSingle();

    if (existing && existing.status === "reviewed") {
      throw new Error("Submission already reviewed");
    }

    let submissionId: string;
    if (existing) {
      const { error } = await supabase
        .from("assignment_submissions")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      submissionId = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("assignment_submissions")
        .insert({
          assignment_id: data.assignment_id,
          student_id: userId,
          ...payload,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      submissionId = inserted.id;
    }

    // ---------- Auto-grade coding submissions ----------
    // Grade against the teacher's expected output using the AI gateway.
    // Bucket correctness into 0 / 25 / 50 / 75 / 100 %, then award marks
    // = round((pct/100) * total_marks * 2) / 2  (nearest 0.5 mark).
    // Never blocks the submission — failures are logged and ignored.
    const auto = await autoGradeCoding({
      assignment: a as any,
      code_answer: data.code_answer ?? null,
      code_output: data.code_output ?? null,
    }).catch((e) => {
      console.error("autoGradeCoding failed", e);
      return null;
    });
    if (auto) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("assignment_submissions")
          .update({
            marks_obtained: auto.marks,
            status: "reviewed",
            reviewed_at: new Date().toISOString(),
            teacher_feedback: `Auto-graded by AI (${auto.pct}% correct). ${auto.reason}`.slice(0, 2000),
          })
          .eq("id", submissionId);
      } catch (e) {
        console.error("auto-grade write failed", e);
      }
    }

    return { id: submissionId, is_late: isLate, auto_graded: auto ? auto.marks : null };
  });

// -----------------------------------------------------------------------------
// AI auto-grader for coding homework submissions.
// -----------------------------------------------------------------------------
async function autoGradeCoding(input: {
  assignment: {
    assignment_type?: string | null;
    total_marks?: number | null;
    expected_output?: string | null;
    sample_input?: string | null;
    sample_output?: string | null;
    title?: string | null;
    description?: string | null;
  };
  code_answer: string | null;
  code_output: string | null;
}): Promise<{ marks: number; pct: number; reason: string } | null> {
  const a = input.assignment;
  const type = (a.assignment_type ?? "").toLowerCase();
  if (type !== "coding" && type !== "mixed") return null;
  const total = Number(a.total_marks ?? 0);
  if (!total || total <= 0) return null;
  const code = (input.code_answer ?? "").trim();
  if (!code) return null;
  const expected = (a.expected_output ?? a.sample_output ?? "").trim();

  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;

  const sys = `You are an experienced Python programming teacher grading a student's coding homework.
Judge how correct the student's SOLUTION is with respect to the PROBLEM and the EXPECTED OUTPUT / REFERENCE SOLUTION.
Return ONLY a JSON object with this exact shape:
{ "percent": 0 | 25 | 50 | 75 | 100, "reason": "one short sentence" }

Bucketing rules:
- 0   → empty, off-topic, or fundamentally wrong.
- 25  → attempted but mostly wrong; some relevant idea.
- 50  → about half correct; core logic partially works.
- 75  → mostly correct; small bug, off-by-one, or minor missing case.
- 100 → fully correct, matches the expected behaviour.

Be encouraging but honest. If the student's code visibly tries to solve the right problem, do NOT return 0.
No markdown, no code fences, just JSON.`;

  const user = `PROBLEM TITLE:
${a.title ?? ""}

PROBLEM DESCRIPTION:
${(a.description ?? "").slice(0, 4000)}

SAMPLE INPUT (stdin, may be empty):
${(a.sample_input ?? "").slice(0, 2000)}

EXPECTED OUTPUT / REFERENCE ANSWER (teacher-provided):
${expected.slice(0, 4000)}

STUDENT CODE:
\`\`\`python
${code.slice(0, 8000)}
\`\`\`

STUDENT PROGRAM STDOUT (from their last run, may be empty):
${(input.code_output ?? "").slice(0, 2000)}
`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  let parsed: { percent?: number; reason?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const allowed = [0, 25, 50, 75, 100];
  let pct = Number(parsed.percent);
  if (!allowed.includes(pct)) {
    // snap to nearest allowed bucket
    pct = allowed.reduce((best, v) => (Math.abs(v - pct) < Math.abs(best - pct) ? v : best), 0);
  }
  const marks = Math.round((pct / 100) * total * 2) / 2;
  return { marks, pct, reason: (parsed.reason ?? "").toString().slice(0, 300) };
}


// ---------- Admin ----------

const AssignmentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000).default(""),
  unit: z.number().int().min(0).max(1000).nullable().optional(),
  topic: z.string().max(200).nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  assignment_type: z.enum(["coding", "written", "mixed"]).default("coding"),
  total_marks: z.number().int().min(1).max(1000).default(10),
  due_at: z.string().nullable().optional(),
  allow_late_submission: z.boolean().default(false),
  status: z.enum(["draft", "published", "closed"]).default("draft"),
  sample_input: z.string().max(5000).nullable().optional(),
  sample_output: z.string().max(5000).nullable().optional(),
  expected_output: z.string().max(5000).nullable().optional(),
  starter_code: z.string().max(20000).nullable().optional(),
  submission_mode: z.enum(["submit", "self_solve"]).optional(),
  question_source: z.enum(["manual", "ai_generated", "migrated_practice"]).optional(),
  input_format: z.string().max(5000).nullable().optional(),
  output_format: z.string().max(5000).nullable().optional(),
  constraints: z.string().max(5000).nullable().optional(),
  hints: z.string().max(5000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
});


export const adminListAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((a: any) => a.id);
    let counts: Record<string, { total: number; submitted: number; reviewed: number }> = {};
    if (ids.length > 0) {
      const { data: subs } = await supabase
        .from("assignment_submissions")
        .select("assignment_id, status")
        .in("assignment_id", ids);
      for (const id of ids) counts[id] = { total: 0, submitted: 0, reviewed: 0 };
      for (const s of subs ?? []) {
        const c = counts[s.assignment_id];
        c.total++;
        if (s.status === "submitted" || s.status === "late" || s.status === "reviewed") c.submitted++;
        if (s.status === "reviewed") c.reviewed++;
      }
    }
    return (data ?? []).map((a: any) => ({ ...a, counts: counts[a.id] ?? { total: 0, submitted: 0, reviewed: 0 } }));
  });

export const adminCreateAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssignmentInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("assignments")
      .insert({ ...data, created_by: userId })
      .select("id, status, title")
      .single();
    if (error) throw new Error(error.message);
    if (inserted.status === "published") {
      await supabase.from("announcements").insert({
        author_id: userId,
        title: "New assignment assigned",
        body: `📝 New Python assignment: ${inserted.title}. Open "Homework" to get started.`,
        priority: "normal",
      });
    }
    return { id: inserted.id };
  });

const UpdateAssignmentSchema = AssignmentInputSchema.partial().extend({
  id: z.string().uuid(),
});

export const adminUpdateAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateAssignmentSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;
    const { id, ...updates } = data;

    const { data: before } = await supabase
      .from("assignments")
      .select("status, title")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("assignments").update(updates).eq("id", id);
    if (error) throw new Error(error.message);

    if (before && before.status !== "published" && updates.status === "published") {
      await supabase.from("announcements").insert({
        author_id: userId,
        title: "New assignment assigned",
        body: `📝 New Python assignment: ${updates.title ?? before.title}. Open "Homework" to get started.`,
        priority: "normal",
      });
    }
    return { ok: true };
  });

export const adminDeleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("assignments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assignment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase } = context;
    const { data: subs, error } = await supabase
      .from("assignment_submissions")
      .select("*")
      .eq("assignment_id", data.assignment_id)
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((subs ?? []).map((s: any) => s.student_id)));
    let profilesById: Record<string, { display_name: string | null; full_name: string | null; college_name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, college_name")
        .in("id", ids);
      for (const p of profs ?? []) profilesById[p.id] = p;
    }
    return (subs ?? []).map((s: any) => ({ ...s, profile: profilesById[s.student_id] ?? null }));
  });

const ReviewSchema = z.object({
  submission_id: z.string().uuid(),
  marks_obtained: z.number().min(0).max(1000),
  teacher_feedback: z.string().max(5000).optional().nullable(),
});

export const adminReviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;
    const { data: sub, error: sErr } = await supabase
      .from("assignment_submissions")
      .select("id, student_id, assignment_id")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sub) throw new Error("Submission not found");

    const { data: a } = await supabase
      .from("assignments")
      .select("title")
      .eq("id", sub.assignment_id)
      .maybeSingle();

    const { error } = await supabase
      .from("assignment_submissions")
      .update({
        marks_obtained: data.marks_obtained,
        teacher_feedback: data.teacher_feedback ?? null,
        status: "reviewed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", data.submission_id);
    if (error) throw new Error(error.message);

    await supabase.from("announcements").insert({
      author_id: userId,
      title: "Assignment reviewed",
      body: `Your assignment "${a?.title ?? ""}" has been reviewed. Marks: ${data.marks_obtained}.`,
      priority: "normal",
      target_user_id: sub.student_id,
    });

    return { ok: true };
  });
