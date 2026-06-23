// Session storage for mock test handoff and final results (code-question version).

export type QuestionAttempt = {
  questionId: string;
  code: string;
  passed: number;
  total: number;
  marksObtained: number;
  marksTotal: number;
  results: { passed: boolean; expected: string; actual: string; stderr: string }[];
};

export type AttemptResult = {
  testId: string;
  testName: string;
  studentName: string;
  totalQuestions: number;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  timeTakenSec: number;
  submissionType: "normal" | "auto-violation";
  violationReason?: string;
  attempts: QuestionAttempt[];
  submittedAt: number;
};

const KEY = "pykidda:last-result";
const STARTED_KEY = "pykidda:started-tests";
const STARTED_AT_KEY = "pykidda:started-tests-at";
const NAME_KEY = "pykidda:student-name";

export function saveResult(r: AttemptResult) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(r));
}
export function loadResult(): AttemptResult | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as AttemptResult) : null;
}

export function markTestStarted(testId: string, startedAt = Date.now()) {
  if (typeof window === "undefined") return;
  const set = new Set<string>(JSON.parse(sessionStorage.getItem(STARTED_KEY) || "[]"));
  set.add(testId);
  sessionStorage.setItem(STARTED_KEY, JSON.stringify([...set]));

  const startedTimes = JSON.parse(sessionStorage.getItem(STARTED_AT_KEY) || "{}") as Record<string, number>;
  startedTimes[testId] = startedAt;
  sessionStorage.setItem(STARTED_AT_KEY, JSON.stringify(startedTimes));
}
export function isTestStarted(testId: string): boolean {
  if (typeof window === "undefined") return false;
  const set: string[] = JSON.parse(sessionStorage.getItem(STARTED_KEY) || "[]");
  return set.includes(testId);
}
export function getTestStartedAt(testId: string): number | null {
  if (typeof window === "undefined") return null;
  const startedTimes = JSON.parse(sessionStorage.getItem(STARTED_AT_KEY) || "{}") as Record<string, number>;
  const startedAt = startedTimes[testId];
  return Number.isFinite(startedAt) ? startedAt : null;
}
export function clearTestStarted(testId: string) {
  if (typeof window === "undefined") return;
  const set: string[] = JSON.parse(sessionStorage.getItem(STARTED_KEY) || "[]");
  sessionStorage.setItem(STARTED_KEY, JSON.stringify(set.filter((id) => id !== testId)));

  const startedTimes = JSON.parse(sessionStorage.getItem(STARTED_AT_KEY) || "{}") as Record<string, number>;
  delete startedTimes[testId];
  sessionStorage.setItem(STARTED_AT_KEY, JSON.stringify(startedTimes));
}

export function getStudentName(): string {
  if (typeof window === "undefined") return "Student";
  return localStorage.getItem(NAME_KEY) || "Student";
}
export function setStudentName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
}

export function gradeFor(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}
