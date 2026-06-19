// Simple sessionStorage-backed handoff between warning → test → result pages.

export type AttemptResult = {
  testId: string;
  testName: string;
  studentName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  timeTakenSec: number;
  submissionType: "normal" | "auto-violation";
  violationReason?: string;
  answers: Array<{ questionId: string; selected: number | null; correct: number; isCorrect: boolean }>;
  submittedAt: number;
};

const KEY = "ppmtp:last-result";
const STARTED_KEY = "ppmtp:started-tests";
const NAME_KEY = "ppmtp:student-name";

export function saveResult(r: AttemptResult) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(r));
}
export function loadResult(): AttemptResult | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as AttemptResult) : null;
}

export function markTestStarted(testId: string) {
  if (typeof window === "undefined") return;
  const set = new Set(JSON.parse(sessionStorage.getItem(STARTED_KEY) || "[]"));
  set.add(testId);
  sessionStorage.setItem(STARTED_KEY, JSON.stringify([...set]));
}
export function isTestStarted(testId: string): boolean {
  if (typeof window === "undefined") return false;
  const set: string[] = JSON.parse(sessionStorage.getItem(STARTED_KEY) || "[]");
  return set.includes(testId);
}
export function clearTestStarted(testId: string) {
  if (typeof window === "undefined") return;
  const set: string[] = JSON.parse(sessionStorage.getItem(STARTED_KEY) || "[]");
  sessionStorage.setItem(STARTED_KEY, JSON.stringify(set.filter((id) => id !== testId)));
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
