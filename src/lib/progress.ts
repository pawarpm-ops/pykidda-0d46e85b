// Local progress tracker. Stores attempts in localStorage keyed per user (or guest).
// Also mirrors writes to Lovable Cloud (mock_results / practice_attempts) so
// admins/teachers can see cross-student progress.
// Powers the /analytics dashboard.

import type { AttemptResult } from "./test-session";
import { QUESTIONS } from "./questions";
import { supabase } from "@/integrations/supabase/client";
import { submitMockResult } from "./mock-results.functions";
import { submitPracticeAttempt } from "./practice-attempts.functions";

export type PracticeAttempt = {
  questionId: string;
  unit: number;
  passed: number;
  total: number;
  solved: boolean; // all tests passed
  at: number;
};

export type MockSummary = {
  testId: string;
  testName: string;
  percentage: number;
  grade: string;
  marksObtained: number;
  totalMarks: number;
  totalQuestions: number;
  timeTakenSec: number;
  submissionType: "normal" | "auto-violation";
  violationReason?: string;
  at: number;
};

type Store = {
  practice: PracticeAttempt[];
  mocks: MockSummary[];
};

const EMPTY: Store = { practice: [], mocks: [] };

function keyFor(userId: string | null): string {
  return `pykidda:progress:${userId ?? "guest"}`;
}

function read(userId: string | null): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return { ...EMPTY, practice: [], mocks: [] };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      practice: Array.isArray(parsed.practice) ? parsed.practice : [],
      mocks: Array.isArray(parsed.mocks) ? parsed.mocks : [],
    };
  } catch {
    return { ...EMPTY, practice: [], mocks: [] };
  }
}

function write(userId: string | null, s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(userId), JSON.stringify(s));
}

export function recordPracticeAttempt(
  userId: string | null,
  questionId: string,
  passed: number,
  total: number,
) {
  const q = QUESTIONS.find((x) => x.id === questionId);
  if (!q) return;
  const s = read(userId);
  const solved = total > 0 && passed === total;
  s.practice.unshift({
    questionId,
    unit: q.unit,
    passed,
    total,
    solved,
    at: Date.now(),
  });
  s.practice = s.practice.slice(0, 500);
  write(userId, s);

  // Mirror to DB so admins can see cross-student progress (best-effort).
  if (userId) {
    void submitPracticeAttempt({
      data: { questionId, unit: q.unit, passed, total, solved },
    }).catch((e) => console.error("submitPracticeAttempt failed", e));
  }
}

export function recordMockResult(userId: string | null, r: AttemptResult) {
  const s = read(userId);
  s.mocks.unshift({
    testId: r.testId,
    testName: r.testName,
    percentage: r.percentage,
    grade: r.grade,
    marksObtained: r.marksObtained,
    totalMarks: r.totalMarks,
    totalQuestions: r.totalQuestions,
    timeTakenSec: r.timeTakenSec,
    submissionType: r.submissionType,
    violationReason: r.violationReason,
    at: r.submittedAt,
  });
  s.mocks = s.mocks.slice(0, 200);
  write(userId, s);

  if (userId) {
    void submitMockResult({
      data: {
        testId: r.testId,
        testName: r.testName,
        studentName: r.studentName,
        marksObtained: r.marksObtained,
        totalMarks: r.totalMarks,
        percentage: r.percentage,
        grade: r.grade,
        totalQuestions: r.totalQuestions,
        timeTakenSec: r.timeTakenSec,
        submissionType: r.submissionType,
        violationReason: r.violationReason ?? null,
        submittedAt: r.submittedAt,
      },
    }).catch((e) => console.error("submitMockResult failed", e));
  }
}

export function getProgress(userId: string | null): Store {
  return read(userId);
}

export function clearProgress(userId: string | null) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(keyFor(userId));
}

export type Analytics = {
  practiceAttempts: number;
  practiceSolvedUnique: number;
  practiceTotalQuestions: number;
  byUnit: Record<number, { solved: number; total: number; attempts: number }>;
  mockCount: number;
  mockAvgPct: number;
  mockBestPct: number;
  mockViolations: number;
  recentPractice: PracticeAttempt[];
  recentMocks: MockSummary[];
};

export function computeAnalytics(s: Store): Analytics {
  const byUnit: Analytics["byUnit"] = {};
  for (const q of QUESTIONS) {
    if (!byUnit[q.unit]) byUnit[q.unit] = { solved: 0, total: 0, attempts: 0 };
    byUnit[q.unit].total += 1;
  }

  const solvedIds = new Set<string>();
  for (const a of s.practice) {
    if (byUnit[a.unit]) byUnit[a.unit].attempts += 1;
    if (a.solved) solvedIds.add(a.questionId);
  }
  for (const id of solvedIds) {
    const q = QUESTIONS.find((x) => x.id === id);
    if (q && byUnit[q.unit]) byUnit[q.unit].solved += 1;
  }

  const mockPcts = s.mocks.map((m) => m.percentage);
  const mockAvg = mockPcts.length ? Math.round(mockPcts.reduce((a, b) => a + b, 0) / mockPcts.length) : 0;
  const mockBest = mockPcts.length ? Math.max(...mockPcts) : 0;
  const violations = s.mocks.filter((m) => m.submissionType === "auto-violation").length;

  return {
    practiceAttempts: s.practice.length,
    practiceSolvedUnique: solvedIds.size,
    practiceTotalQuestions: QUESTIONS.length,
    byUnit,
    mockCount: s.mocks.length,
    mockAvgPct: mockAvg,
    mockBestPct: mockBest,
    mockViolations: violations,
    recentPractice: s.practice.slice(0, 10),
    recentMocks: s.mocks.slice(0, 10),
  };
}
