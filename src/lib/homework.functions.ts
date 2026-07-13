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
  status: z.enum(["draft", "published", "closed"]).default("draft"),
});

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
    const { data: questions, error: qErr } = await supabase
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
      .select("status, title")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase
      .from("homework")
      .update(updates)
      .eq("id", id);
    if (error) throw new Error(error.message);
    const publishTransition =
      !!before &&
      before.status !== "published" &&
      updates.status === "published";
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
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabase } = context as Ctx;
    const { data: before } = await supabase
      .from("homework")
      .select("title, status")
      .eq("id", data.id)
      .maybeSingle();
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
    const [qRes, aRes, pRes, hRes] = await Promise.all([
      supabase
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
