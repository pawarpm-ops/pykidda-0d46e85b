import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAdminActivity } from "@/lib/audit-log.server";

// Types kept intentionally loose because generated types.ts hasn't been
// regenerated for the new homework tables yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const QuestionTypeEnum = z.enum([
  "coding",
  "short_answer",
  "mcq",
  "descriptive",
  "practice",
]);
const DifficultyEnum = z.enum(["easy", "medium", "hard"]);

const QuestionInput = z.object({
  question_order: z.number().int().min(1).max(500).default(1),
  question_type: QuestionTypeEnum.default("coding"),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).default(""),
  marks: z.number().min(0).max(1000).default(1),
  difficulty: DifficultyEnum.default("easy"),
  input_format: z.string().max(5000).nullable().optional(),
  output_format: z.string().max(5000).nullable().optional(),
  sample_input: z.string().max(10000).nullable().optional(),
  sample_output: z.string().max(10000).nullable().optional(),
  test_cases: z.array(z.any()).default([]),
  hints: z.string().max(5000).nullable().optional(),
  mcq_options: z.array(z.string()).nullable().optional(),
  mcq_correct: z.string().nullable().optional(),
  starter_code: z.string().max(20000).nullable().optional(),
});

const HomeworkInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).default(""),
  instructions: z.string().max(20000).nullable().optional(),
  due_at: z.string().nullable().optional(),
  allow_late_submission: z.boolean().default(true),
  estimated_minutes: z.number().int().min(1).max(100000).nullable().optional(),
  status: z.enum(["draft", "published", "closed"]).default("draft"),
});

type QRowForValidation = {
  id: string;
  question_type: string;
  title: string | null;
  description: string | null;
  marks: number | null;
  test_cases: unknown;
  mcq_options: string[] | null;
  mcq_correct: string | null;
};

function validateQuestionForPublish(q: QRowForValidation, idx: number): string[] {
  const errs: string[] = [];
  const label = `Q${idx + 1}`;
  if (!q.title || !q.title.trim()) errs.push(`${label}: title is required`);
  if (!q.description || !q.description.trim())
    errs.push(`${label}: description is required`);
  const marks = Number(q.marks ?? 0);
  if (!Number.isFinite(marks) || marks <= 0)
    errs.push(`${label}: marks must be greater than 0`);
  if (q.question_type === "coding" || q.question_type === "practice") {
    const tc = Array.isArray(q.test_cases) ? (q.test_cases as unknown[]) : [];
    const valid = tc.filter(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof (t as { input?: unknown }).input === "string" &&
        typeof (t as { expected?: unknown }).expected === "string" &&
        (t as { expected: string }).expected.length > 0,
    );
    if (valid.length === 0)
      errs.push(`${label}: needs at least one valid test case`);
  }
  if (q.question_type === "mcq") {
    const opts = (q.mcq_options ?? []).map((o) => (o ?? "").trim()).filter(Boolean);
    const unique = new Set(opts);
    if (opts.length < 2 || unique.size < 2)
      errs.push(`${label}: needs at least two unique options`);
    if (!q.mcq_correct || !opts.includes(q.mcq_correct.trim()))
      errs.push(`${label}: correct option must match one of the options`);
  }
  return errs;
}

// ================== STUDENT ==================

export const listStudentHomework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: hw, error } = await supabase
      .from("homework")
      .select(
        "id, title, description, instructions, due_at, total_marks, status, created_at",
      )
      .in("status", ["published", "closed"])
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    const ids = (hw ?? []).map((h: { id: string }) => h.id);
    let questionCounts: Record<string, number> = {};
    let subs: Record<
      string,
      {
        id: string;
        status: string;
        is_late: boolean;
        submitted_at: string | null;
        total_marks_obtained: number | null;
      }
    > = {};
    if (ids.length) {
      const [qRes, sRes] = await Promise.all([
        supabase
          .from("homework_questions")
          .select("homework_id")
          .in("homework_id", ids),
        supabase
          .from("homework_submissions")
          .select(
            "id, homework_id, status, is_late, submitted_at, total_marks_obtained",
          )
          .eq("student_id", userId)
          .in("homework_id", ids),
      ]);
      for (const r of qRes.data ?? [])
        questionCounts[r.homework_id] =
          (questionCounts[r.homework_id] ?? 0) + 1;
      for (const s of sRes.data ?? []) subs[s.homework_id] = s;
    }

    return ((hw ?? []) as any[]).map((h: any) => ({
      ...h,
      question_count: questionCounts[h.id] ?? 0,
      submission: subs[h.id] ?? null,
    }));
  });

export const getStudentHomework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: hw, error } = await supabase
      .from("homework")
      .select(
        "id, title, description, instructions, due_at, allow_late_submission, total_marks, status",
      )
      .eq("id", data.id)
      .in("status", ["published", "closed"])
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!hw) throw new Error("Homework not found");

    const { data: questions, error: qErr } = await supabase
      .from("homework_questions")
      .select(
        // NOTE: no test_cases / mcq_correct returned to students
        "id, question_order, question_type, title, description, marks, difficulty, input_format, output_format, sample_input, sample_output, hints, mcq_options, starter_code",
      )
      .eq("homework_id", data.id)
      .order("question_order", { ascending: true });
    if (qErr) throw new Error(qErr.message);

    const { data: submission } = await supabase
      .from("homework_submissions")
      .select(
        "id, status, is_late, submitted_at, total_marks_obtained, teacher_feedback, checked_at",
      )
      .eq("homework_id", data.id)
      .eq("student_id", userId)
      .maybeSingle();

    let answers: Array<{
      id: string;
      homework_question_id: string;
      student_answer: string | null;
      student_code: string | null;
      execution_output: string | null;
      marks_awarded: number | null;
      teacher_comment: string | null;
      checked_status: string;
    }> = [];
    if (submission) {
      const { data: ans } = await supabase
        .from("homework_question_answers")
        .select(
          "id, homework_question_id, student_answer, student_code, execution_output, marks_awarded, teacher_comment, checked_status",
        )
        .eq("submission_id", submission.id);
      answers = ans ?? [];
    }

    return { homework: hw, questions: questions ?? [], submission, answers };
  });

const AnswerInput = z.object({
  homework_id: z.string().uuid(),
  homework_question_id: z.string().uuid(),
  student_answer: z.string().max(50000).nullable().optional(),
  student_code: z.string().max(100000).nullable().optional(),
  execution_output: z.string().max(50000).nullable().optional(),
});

async function ensureSubmission(
  supabase: Ctx["supabase"],
  userId: string,
  homework_id: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("homework_submissions")
    .select("id, status")
    .eq("homework_id", homework_id)
    .eq("student_id", userId)
    .maybeSingle();
  if (existing) {
    if (existing.status === "checked")
      throw new Error("Homework already checked, cannot edit");
    return existing.id;
  }
  const { data: inserted, error } = await supabase
    .from("homework_submissions")
    .insert({
      homework_id,
      student_id: userId,
      status: "not_submitted",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

export const saveHomeworkAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnswerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const submissionId = await ensureSubmission(
      supabase,
      userId,
      data.homework_id,
    );
    const { data: existing } = await supabase
      .from("homework_question_answers")
      .select("id")
      .eq("submission_id", submissionId)
      .eq("homework_question_id", data.homework_question_id)
      .maybeSingle();

    const payload = {
      student_answer: data.student_answer ?? null,
      student_code: data.student_code ?? null,
      execution_output: data.execution_output ?? null,
    };

    if (existing) {
      const { error } = await supabase
        .from("homework_question_answers")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, submission_id: submissionId };
    }
    const { data: inserted, error } = await supabase
      .from("homework_question_answers")
      .insert({
        submission_id: submissionId,
        homework_question_id: data.homework_question_id,
        ...payload,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, submission_id: submissionId };
  });

export const submitHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ homework_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: hw, error: hErr } = await supabase
      .from("homework")
      .select("id, due_at, status, allow_late_submission, title")
      .eq("id", data.homework_id)
      .in("status", ["published", "closed"])
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!hw) throw new Error("Homework not found");

    const now = new Date();
    const isLate = hw.due_at ? now > new Date(hw.due_at) : false;
    if (isLate && !hw.allow_late_submission) {
      throw new Error("Late submissions are not allowed for this homework");
    }

    const submissionId = await ensureSubmission(supabase, userId, hw.id);

    // One-time submission: reject if already submitted/late/checked/returned.
    const { data: existing, error: exErr } = await supabase
      .from("homework_submissions")
      .select("status")
      .eq("id", submissionId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (existing && ["submitted", "late", "checked", "returned"].includes(existing.status)) {
      throw new Error("You have already submitted this homework.");
    }

    const { error } = await supabase
      .from("homework_submissions")
      .update({
        status: isLate ? "late" : "submitted",
        is_late: isLate,
        submitted_at: now.toISOString(),
      })
      .eq("id", submissionId);
    if (error) throw new Error(error.message);

    try {
      await supabase.rpc("record_streak_activity", {
        _activity_type: "homework_submitted",
        _reference_id: hw.id,
      });
    } catch (e) {
      console.error("[submitHomework] streak record failed", e);
    }

    return { id: submissionId, is_late: isLate };
  });

// ================== ADMIN ==================

export const adminListHomework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: hw, error } = await supabase
      .from("homework")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (hw ?? []).map((h: { id: string }) => h.id);
    const counts: Record<
      string,
      { questions: number; submissions: number; checked: number }
    > = {};
    for (const id of ids)
      counts[id] = { questions: 0, submissions: 0, checked: 0 };
    if (ids.length) {
      const [q, s] = await Promise.all([
        supabase
          .from("homework_questions")
          .select("homework_id")
          .in("homework_id", ids),
        supabase
          .from("homework_submissions")
          .select("homework_id, status")
          .in("homework_id", ids),
      ]);
      for (const r of q.data ?? []) counts[r.homework_id].questions++;
      for (const r of s.data ?? []) {
        if (
          ["submitted", "late", "checked", "returned"].includes(r.status)
        )
          counts[r.homework_id].submissions++;
        if (r.status === "checked") counts[r.homework_id].checked++;
      }
    }
    return ((hw ?? []) as any[]).map((h: any) => ({
      ...h,
      counts: counts[h.id],
    }));
  });

export const adminGetHomework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: hw, error } = await supabase
      .from("homework")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!hw) throw new Error("Not found");
    // Use service role to read answer-key columns (mcq_correct, test_cases)
    // which are hidden from the authenticated role at the column level.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions, error: qErr } = await supabaseAdmin
      .from("homework_questions")
      .select("*")
      .eq("homework_id", data.id)
      .order("question_order", { ascending: true });
    if (qErr) throw new Error(qErr.message);
    return { homework: hw, questions: questions ?? [] };
  });

export const adminCreateHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HomeworkInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase, userId } = context as Ctx;
    const { data: inserted, error } = await supabase
      .from("homework")
      .insert({ ...data, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAdminActivity(supabase, {
      actionType: "homework.created",
      description: `Created homework: ${data.title}`,
      moduleName: "homework",
      targetId: inserted.id,
      targetTitle: data.title,
      newValue: { title: data.title, status: data.status ?? "draft" },
    });
    return { id: inserted.id };
  });

export const adminUpdateHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    HomeworkInput.partial().extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase, userId } = context as Ctx;
    const { id, ...updates } = data;
    const { data: before } = await supabase
      .from("homework")
      .select("status, title, due_at")
      .eq("id", id)
      .maybeSingle();
    const publishTransition =
      !!before &&
      before.status !== "published" &&
      updates.status === "published";
    // Strict server-side validation on publish
    if (publishTransition) {
      const nextTitle = (updates.title ?? before?.title ?? "").trim();
      if (!nextTitle) throw new Error("Homework title is required to publish.");
      const dueRaw = updates.due_at ?? before?.due_at ?? null;
      if (!dueRaw)
        throw new Error("A valid due date is required to publish.");
      const dueDate = new Date(dueRaw);
      if (Number.isNaN(dueDate.getTime()))
        throw new Error("Due date is invalid.");
      if (dueDate.getTime() <= Date.now())
        throw new Error("Due date must be in the future.");
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { data: qs, error: qErr } = await supabaseAdmin
        .from("homework_questions")
        .select(
          "id, question_type, title, description, marks, test_cases, mcq_options, mcq_correct",
        )
        .eq("homework_id", id)
        .order("question_order");
      if (qErr) throw new Error(qErr.message);
      const questions = (qs ?? []) as QRowForValidation[];
      if (questions.length === 0)
        throw new Error("Add at least one question before publishing.");
      const errs: string[] = [];
      questions.forEach((q, i) => errs.push(...validateQuestionForPublish(q, i)));
      if (errs.length)
        throw new Error(
          "Cannot publish — fix these issues first:\n• " + errs.join("\n• "),
        );
    }
    const { error } = await supabase
      .from("homework")
      .update(updates)
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (publishTransition) {
      await supabase.from("announcements").insert({
        author_id: userId,
        title: "New homework assigned",
        body: `📝 New Python homework: ${updates.title ?? before.title}. Open "Homework" to begin.`,
        priority: "normal",
      });
    }
    const finalTitle = updates.title ?? before?.title ?? "(untitled)";
    await logAdminActivity(supabase, {
      actionType: publishTransition ? "homework.published" : "homework.updated",
      description: publishTransition
        ? `Published homework: ${finalTitle}`
        : `Updated homework: ${finalTitle}`,
      moduleName: "homework",
      targetId: id,
      targetTitle: finalTitle,
      oldValue: before ?? null,
      newValue: updates,
    });
    return { ok: true };
  });

export const adminDeleteHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), force: z.boolean().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: before } = await supabase
      .from("homework")
      .select("title, status")
      .eq("id", data.id)
      .maybeSingle();
    if (before?.status === "published" && !data.force) {
      const { count } = await supabase
        .from("homework_submissions")
        .select("id", { count: "exact", head: true })
        .eq("homework_id", data.id)
        .in("status", ["submitted", "late", "checked", "returned"]);
      if ((count ?? 0) > 0) {
        throw new Error(
          `This homework is published and has ${count} submission(s). Close it or pass force=true to delete anyway.`,
        );
      }
    }
    const { error } = await supabase
      .from("homework")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminActivity(supabase, {
      actionType: "homework.deleted",
      description: `Deleted homework: ${before?.title ?? data.id}`,
      moduleName: "homework",
      targetId: data.id,
      targetTitle: before?.title ?? null,
      oldValue: before,
    });
    return { ok: true };
  });


export const adminAddQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    QuestionInput.extend({ homework_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: inserted, error } = await supabase
      .from("homework_questions")
      .insert({
        ...data,
        test_cases: data.test_cases ?? [],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const adminUpdateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    QuestionInput.partial().extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { id, ...updates } = data;
    const { error } = await (context as Ctx).supabase
      .from("homework_questions")
      .update(updates)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await (context as Ctx).supabase
      .from("homework_questions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDuplicateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: src, error: sErr } = await supabaseAdmin
      .from("homework_questions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!src) throw new Error("Question not found");
    const { data: sib } = await supabaseAdmin
      .from("homework_questions")
      .select("question_order")
      .eq("homework_id", src.homework_id)
      .order("question_order", { ascending: false })
      .limit(1);
    const nextOrder = ((sib?.[0]?.question_order as number | undefined) ?? 0) + 1;
    const {
      id: _omit,
      created_at: _c,
      updated_at: _u,
      ...rest
    } = src as Record<string, unknown>;
    void _omit; void _c; void _u;
    const insertRow = {
      ...rest,
      question_order: nextOrder,
      title: `${(src as { title?: string }).title ?? "Question"} (copy)`,
    };
    const { data: inserted, error } = await (context as Ctx).supabase
      .from("homework_questions")
      .insert(insertRow)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const adminReorderQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order: z.array(
          z.object({ id: z.string().uuid(), question_order: z.number().int() }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    for (const o of data.order) {
      const { error } = await supabase
        .from("homework_questions")
        .update({ question_order: o.question_order })
        .eq("id", o.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---- Grading ----

export const adminListSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ homework_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: subs, error } = await supabase
      .from("homework_submissions")
      .select("*")
      .eq("homework_id", data.homework_id)
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(
      new Set((subs ?? []).map((s: { student_id: string }) => s.student_id)),
    );
    let profiles: Record<
      string,
      { display_name: string | null; full_name: string | null }
    > = {};
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", ids);
      for (const row of p ?? []) profiles[row.id] = row;
    }
    return (subs ?? []).map((s: { student_id: string }) => ({
      ...s,
      profile: profiles[s.student_id] ?? null,
    }));
  });

export const adminGetSubmissionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ submission_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: sub, error } = await supabase
      .from("homework_submissions")
      .select("*")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Not found");
    // Admin grading needs full question rows including answer keys.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [qRes, aRes, pRes, hRes] = await Promise.all([
      supabaseAdmin
        .from("homework_questions")
        .select("*")
        .eq("homework_id", sub.homework_id)
        .order("question_order"),
      supabase
        .from("homework_question_answers")
        .select("*")
        .eq("submission_id", data.submission_id),
      supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .eq("id", sub.student_id)
        .maybeSingle(),
      supabase
        .from("homework")
        .select("id, title, total_marks, due_at")
        .eq("id", sub.homework_id)
        .maybeSingle(),
    ]);
    return {
      submission: sub,
      homework: hRes.data,
      questions: qRes.data ?? [],
      answers: aRes.data ?? [],
      profile: pRes.data,
    };
  });

export const adminGradeAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        answer_id: z.string().uuid(),
        marks_awarded: z.number().min(0).max(1000).nullable(),
        teacher_comment: z.string().max(5000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: before } = await supabase
      .from("homework_question_answers")
      .select("id, submission_id, marks_awarded, teacher_comment, submissions:homework_submissions(student_id, homework_id)")
      .eq("id", data.answer_id)
      .maybeSingle();
    const { error } = await supabase
      .from("homework_question_answers")
      .update({
        marks_awarded: data.marks_awarded,
        teacher_comment: data.teacher_comment ?? null,
        checked_status: "checked",
      })
      .eq("id", data.answer_id);
    if (error) throw new Error(error.message);
    const studentId =
      (before as { submissions?: { student_id?: string } } | null)?.submissions
        ?.student_id ?? null;
    const commentChanged =
      (before?.teacher_comment ?? null) !==
      (data.teacher_comment ?? null);
    await logAdminActivity(supabase, {
      actionType: commentChanged ? "marks.comment_updated" : "marks.updated",
      description: commentChanged
        ? `Updated teacher comment on homework answer`
        : `Updated marks to ${data.marks_awarded ?? "—"} on homework answer`,
      moduleName: "marks",
      targetId: data.answer_id,
      relatedStudentId: studentId,
      oldValue: {
        marks_awarded: before?.marks_awarded ?? null,
        teacher_comment: before?.teacher_comment ?? null,
      },
      newValue: {
        marks_awarded: data.marks_awarded,
        teacher_comment: data.teacher_comment ?? null,
      },
    });
    return { ok: true };
  });

export const adminFinalizeCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        submission_id: z.string().uuid(),
        teacher_feedback: z.string().max(10000).nullable().optional(),
        return_for_correction: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase, userId } = context as Ctx;
    const { data: sub, error: sErr } = await supabase
      .from("homework_submissions")
      .select("id, student_id, homework_id")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sub) throw new Error("Not found");
    const { data: hw } = await supabase
      .from("homework")
      .select("title")
      .eq("id", sub.homework_id)
      .maybeSingle();
    const { error } = await supabase
      .from("homework_submissions")
      .update({
        teacher_feedback: data.teacher_feedback ?? null,
        status: data.return_for_correction ? "returned" : "checked",
        checked_by: userId,
        checked_at: new Date().toISOString(),
      })
      .eq("id", data.submission_id);
    if (error) throw new Error(error.message);
    await supabase.from("announcements").insert({
      author_id: userId,
      title: data.return_for_correction
        ? "Homework returned for correction"
        : "Homework checked",
      body: data.return_for_correction
        ? `Your homework "${hw?.title ?? ""}" was returned for corrections. Open Homework to review.`
        : `Your homework "${hw?.title ?? ""}" has been checked. Open Homework to see feedback.`,
      priority: "normal",
      target_user_id: sub.student_id,
    });
    await logAdminActivity(supabase, {
      actionType: data.return_for_correction
        ? "homework.returned_for_correction"
        : "homework.checked",
      description: data.return_for_correction
        ? `Returned homework for correction: ${hw?.title ?? ""}`
        : `Finalized homework check: ${hw?.title ?? ""}`,
      moduleName: "homework",
      targetId: data.submission_id,
      targetTitle: hw?.title ?? null,
      relatedStudentId: sub.student_id,
      newValue: { teacher_feedback: data.teacher_feedback ?? null },
    });
    return { ok: true };
  });

// ================== AI GENERATION ==================

const AiGenerateInput = z.object({
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(400),
  difficulty: DifficultyEnum.default("medium"),
  count: z.number().int().min(1).max(10).default(3),
  marks_per_question: z.number().int().min(1).max(100).default(10),
  instructions: z.string().max(4000).default(""),
  publish: z.boolean().default(false),
  // Optional reference file the AI should base the homework on.
  // file_data must be a `data:<mime>;base64,...` URL. Keep under ~6 MB.
  reference_file: z
    .object({
      name: z.string().max(200),
      mime: z.string().max(200),
      data_url: z
        .string()
        .max(9_000_000)
        .refine((s) => s.startsWith("data:") && s.includes(";base64,"), {
          message: "reference_file.data_url must be a base64 data URL",
        }),
    })
    .nullable()
    .optional(),
});

const AiHwQuestion = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  input_format: z.string().default(""),
  output_format: z.string().default(""),
  sample_input: z.string().default(""),
  sample_output: z.string().default(""),
  hints: z.string().default(""),
  starter_code: z.string().default(""),
  difficulty: DifficultyEnum.default("medium"),
  marks: z.number().int().min(1).max(100).default(10),
});

export const adminGenerateHomeworkWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiGenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase, userId } = context as Ctx;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this project.");

    const ref = data.reference_file ?? null;
    const refNote = ref
      ? `\n- A reference file (${ref.name}) is attached below. Base the questions on its content when relevant.`
      : "";

    const sys = `You are an expert Python teacher creating homework for engineering students.
Return ONLY a JSON object of this exact shape (no markdown):
{
  "questions": [
    {
      "title": "short title",
      "description": "clear multi-line problem statement",
      "input_format": "how input is provided (may be empty)",
      "output_format": "expected output shape",
      "sample_input": "example input as it would be typed",
      "sample_output": "example output — no trailing newline",
      "hints": "brief teacher-only hint",
      "starter_code": "optional short Python skeleton with a TODO",
      "difficulty": "easy" | "medium" | "hard",
      "marks": integer
    }
  ]
}
Rules:
- Produce EXACTLY ${data.count} coding questions on the topic below.
- Difficulty target: "${data.difficulty}".
- Each question ~${data.marks_per_question} marks.
- All Python must run on plain CPython/Pyodide: no file I/O, no plotting, no pandas.${refNote}`;

    const userText = `Homework title: ${data.title}
Topic: ${data.topic}
${data.instructions.trim() ? `Extra instructions:\n"""\n${data.instructions.slice(0, 4000)}\n"""` : ""}`;

    // Build multimodal user content when a reference file is attached.
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
        // Decode small text files inline so any model can read them.
        try {
          const b64 = ref.data_url.split(";base64,")[1] ?? "";
          const decoded = Buffer.from(b64, "base64").toString("utf8").slice(0, 60000);
          blocks.push({
            type: "text",
            text: `Reference file "${ref.name}":\n"""\n${decoded}\n"""`,
          });
        } catch {
          blocks.push({
            type: "file",
            file: { filename: ref.name, file_data: ref.data_url },
          });
        }
      } else {
        // PDFs and other docs go as a file block.
        blocks.push({
          type: "file",
          file: { filename: ref.name, file_data: ref.data_url },
        });
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
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings → Plans & credits.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI could not generate homework right now. (${res.status}) ${t.slice(0, 160)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { questions?: unknown[] };
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned an unreadable response. Please try again.");
      parsed = JSON.parse(m[0]);
    }
    const rawQs = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rawQs
      .map((q) => {
        const r = AiHwQuestion.safeParse({
          marks: data.marks_per_question,
          difficulty: data.difficulty,
          ...(q as object),
        });
        return r.success ? r.data : null;
      })
      .filter((q): q is z.infer<typeof AiHwQuestion> => q !== null);
    if (questions.length === 0) {
      throw new Error("AI could not generate homework right now. Please try again.");
    }

    // Create homework row
    const { data: hw, error: hwErr } = await supabase
      .from("homework")
      .insert({
        title: data.title,
        description: `AI-generated homework on: ${data.topic}`,
        instructions: data.instructions || null,
        status: data.publish ? "published" : "draft",
        allow_late_submission: true,
        created_by: userId,
      })
      .select("id")
      .single();
    if (hwErr) throw new Error(hwErr.message);

    // Insert questions
    const rows = questions.map((q, i) => ({
      homework_id: hw.id,
      question_order: i + 1,
      question_type: "coding" as const,
      title: q.title,
      description: q.description,
      marks: q.marks,
      difficulty: q.difficulty,
      input_format: q.input_format || null,
      output_format: q.output_format || null,
      sample_input: q.sample_input || null,
      sample_output: q.sample_output || null,
      hints: q.hints || null,
      starter_code: q.starter_code || null,
      test_cases: [],
    }));
    const { error: qErr } = await supabase.from("homework_questions").insert(rows);
    if (qErr) throw new Error(qErr.message);

    await logAdminActivity(supabase, {
      actionType: "homework.ai_generated",
      description: `AI-generated homework: ${data.title} (${questions.length} questions)`,
      moduleName: "homework",
      targetId: hw.id,
      targetTitle: data.title,
      metadata: { count: questions.length, difficulty: data.difficulty },
    });

    return { id: hw.id, question_count: questions.length };
  });
