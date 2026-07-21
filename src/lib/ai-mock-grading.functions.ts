// Teacher-side grading for scheduled mock test attempts.
// Scheduled tests are held in `pending_review` on submit; a teacher edits
// per-question marks + comments here and publishes to release scores to the
// student and count them on the leaderboard.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAdminActivity } from "@/lib/audit-log.server";
import { z } from "zod";

async function assertAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

function gradeFor(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

// -------- List attempts on a scheduled test for review --------

export const listAttemptsForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ test_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };

    const { data: test, error: tErr } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("id,title,test_kind,total_marks,question_count,scheduled_start_at,scheduled_end_at")
      .eq("id", data.test_id)
      .single();
    if (tErr) throw new Error(tErr.message);

    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("ai_mock_attempts")
      .select("id,user_id,submitted_at,time_taken_sec,submission_type,violation_reason,marks_obtained,total_marks,percentage,grade,grading_status,auto_marks_obtained,auto_percentage,reviewed_at")
      .eq("test_id", data.test_id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (aErr) throw new Error(aErr.message);

    const rows = (attempts ?? []) as Array<{ user_id: string }>;
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    let profileMap: Record<string, { display_name: string | null; student_unique_id: string | null; avatar_url: string | null }> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,display_name,student_unique_id,avatar_url")
        .in("id", ids);
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; student_unique_id: string | null; avatar_url: string | null }>) {
        profileMap[p.id] = { display_name: p.display_name, student_unique_id: p.student_unique_id, avatar_url: p.avatar_url };
      }
    }

    return { test, attempts: attempts ?? [], profiles: profileMap };
  });

// -------- Get one attempt with everything the teacher needs --------

export const getAttemptForGrading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };

    const { data: attempt, error: aErr } = await supabaseAdmin
      .from("ai_mock_attempts")
      .select("*")
      .eq("id", data.attempt_id)
      .single();
    if (aErr) throw new Error(aErr.message);

    const { data: test } = await supabaseAdmin
      .from("ai_mock_tests")
      .select("id,title,test_kind,total_marks,scheduled_start_at,scheduled_end_at")
      .eq("id", attempt.test_id)
      .single();

    const { data: questions, error: qErr } = await supabaseAdmin
      .from("ai_mock_questions")
      .select("id,order_index,type,prompt,options,correct_answer,starter_code,code_tests,marks,explanation")
      .eq("test_id", attempt.test_id)
      .order("order_index");
    if (qErr) throw new Error(qErr.message);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,display_name,student_unique_id,avatar_url,college_name")
      .eq("id", attempt.user_id)
      .maybeSingle();

    return { attempt, test, questions: questions ?? [], profile };
  });

// -------- Save / publish grading --------

const PerQuestionSchema = z.object({
  question_id: z.string().uuid(),
  marks_awarded: z.number().min(0).max(50),
  teacher_comment: z.string().max(2000).default(""),
});

const SaveGradingInput = z.object({
  attempt_id: z.string().uuid(),
  per_question: z.array(PerQuestionSchema).max(200),
  teacher_feedback: z.string().max(4000).default(""),
  publish: z.boolean().default(false),
});

export const saveGrading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveGradingInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server") as unknown as { supabaseAdmin: any };

    const { data: attempt, error: aErr } = await supabaseAdmin
      .from("ai_mock_attempts")
      .select("id,user_id,test_id,answers,auto_marks_obtained,auto_percentage")
      .eq("id", data.attempt_id)
      .single();
    if (aErr) throw new Error(aErr.message);

    const { data: questions, error: qErr } = await supabaseAdmin
      .from("ai_mock_questions")
      .select("id,marks")
      .eq("test_id", attempt.test_id);
    if (qErr) throw new Error(qErr.message);
    const qMarks = new Map<string, number>();
    for (const q of (questions ?? []) as Array<{ id: string; marks: number }>) qMarks.set(q.id, q.marks);

    const edits = new Map(data.per_question.map((p) => [p.question_id, p]));
    let marksObtained = 0;
    let totalMarks = 0;
    const existing = Array.isArray(attempt.answers) ? (attempt.answers as Array<Record<string, unknown>>) : [];
    const nextAnswers = existing.map((row) => {
      const qid = String((row as any).question_id ?? "");
      const cap = qMarks.get(qid) ?? Number((row as any).marks_total ?? 0);
      totalMarks += cap;
      const edit = edits.get(qid);
      const finalMarks = edit
        ? Math.max(0, Math.min(cap, Number(edit.marks_awarded) || 0))
        : Number((row as any).marks_awarded ?? 0);
      marksObtained += finalMarks;
      return {
        ...row,
        marks_awarded: finalMarks,
        marks_total: cap,
        teacher_comment: edit ? edit.teacher_comment : String((row as any).teacher_comment ?? ""),
        correct: cap > 0 && finalMarks >= cap,
      };
    });

    const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
    const grade = data.publish ? gradeFor(percentage) : "-";
    const status = data.publish ? "published" : "in_review";

    const { error: uErr } = await supabaseAdmin
      .from("ai_mock_attempts")
      .update({
        answers: nextAnswers,
        marks_obtained: data.publish ? marksObtained : 0,
        percentage: data.publish ? percentage : 0,
        grade,
        teacher_feedback: data.teacher_feedback,
        grading_status: status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.attempt_id);
    if (uErr) throw new Error(uErr.message);

    // If published, recompute the student's leaderboard aggregate.
    if (data.publish) {
      try {
        const { data: pubAttempts } = await supabaseAdmin
          .from("ai_mock_attempts")
          .select("percentage, test_id, ai_mock_tests!inner(test_kind)")
          .eq("user_id", attempt.user_id)
          .eq("grading_status", "published")
          .eq("ai_mock_tests.test_kind", "scheduled");
        const bestByTest = new Map<string, number>();
        for (const r of (pubAttempts ?? []) as Array<{ percentage: number | null; test_id: string }>) {
          const pct = r.percentage ?? 0;
          const cur = bestByTest.get(r.test_id) ?? 0;
          if (pct > cur) bestByTest.set(r.test_id, pct);
        }
        let score = 0;
        let mockBest = 0;
        for (const pct of bestByTest.values()) {
          score += pct;
          if (pct > mockBest) mockBest = pct;
        }
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("display_name,avatar_url")
          .eq("id", attempt.user_id)
          .maybeSingle();
        await supabaseAdmin.from("leaderboard_scores").upsert(
          {
            user_id: attempt.user_id,
            display_name: prof?.display_name ?? "Student",
            avatar_url: prof?.avatar_url ?? null,
            score,
            solved_count: bestByTest.size,
            mock_best: mockBest,
            mocks_taken: bestByTest.size,
          },
          { onConflict: "user_id" },
        );
      } catch (e) {
        console.error("[saveGrading] leaderboard sync failed", e);
      }

      // Notify the student their scheduled mock has been graded.
      try {
        const { data: testRow } = await supabaseAdmin
          .from("ai_mock_tests")
          .select("title")
          .eq("id", attempt.test_id)
          .maybeSingle();
        const title = testRow?.title ?? "your scheduled mock test";
        await supabaseAdmin.from("announcements").insert({
          author_id: context.userId,
          title: `Your grade is ready: ${title}`,
          body: `Your teacher has graded your submission. You scored ${marksObtained}/${totalMarks} (${percentage}%). Tap View to see per-question feedback.`,
          priority: "high",
          target_user_id: attempt.user_id,
          action_url: `/mock-tests/ai/${attempt.test_id}/result?attempt=${data.attempt_id}`,
        });
      } catch (e) {
        console.error("[saveGrading] notification insert failed", e);
      }
    }

    await logAdminActivity(context.supabase, {
      actionType: data.publish ? "mock_attempt.published" : "mock_attempt.reviewed",
      description: data.publish
        ? `Published grades for attempt (${marksObtained}/${totalMarks} = ${percentage}%)`
        : `Saved grading draft (${marksObtained}/${totalMarks} = ${percentage}%)`,
      moduleName: "mock_test",
      targetId: data.attempt_id,
      relatedStudentId: attempt.user_id,
      newValue: { marks_obtained: marksObtained, total_marks: totalMarks, percentage, grading_status: status },
    });

    return {
      ok: true,
      marks_obtained: marksObtained,
      total_marks: totalMarks,
      percentage,
      grading_status: status,
    };
  });
