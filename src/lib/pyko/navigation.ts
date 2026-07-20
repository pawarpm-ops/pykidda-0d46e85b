// Pyko AI — verified navigation registry and intent detection.
// Client-safe: no server-only imports. Used by:
//   - server router to emit trusted <pyko-actions> blocks (role-checked)
//   - client PykoMessage to render PykoActionCard from that block
//
// The model never invents URLs. It (or the server) only chooses a routeKey
// from PYKO_ROUTE_KEYS; the client maps that key to a real internal route.

import { z } from "zod";
import { resolveIntent, type GuideTopic } from "./intent";
import type { FileRouteTypes } from "@/routeTree.gen";

// Compile-time guarantee: every `route` in PYKO_NAVIGATION_ROUTES must exist
// in the generated TanStack route tree (using the same `to` type <Link>
// accepts). If a route file is renamed or deleted, TypeScript fails the
// build here instead of Pyko emitting a broken action card at runtime.
// Do not weaken this type; add a real route file instead.
type VerifiedRoute = FileRouteTypes["to"];

export const PYKO_ROUTE_KEYS = [
  "practice",
  "homework",
  "assignments",
  "mockTests",
  "scheduledMockTests",
  "notifications",
  "profile",
  "leaderboard",
  "streakJourney",
  "badges",
  "help",
  // Admin-only keys — never emitted for students.
  "adminHomework",
  "adminPractice",
  "adminAssignments",
] as const;

export type PykoRouteKey = (typeof PYKO_ROUTE_KEYS)[number];

export type PykoRouteEntry = {
  route: VerifiedRoute;
  hash?: string;
  label: string;
  icon: string;
  title: string;
  description: string;
  adminOnly?: boolean;
};

export const PYKO_NAVIGATION_ROUTES: Record<PykoRouteKey, PykoRouteEntry> = {
  practice: {
    route: "/practice",
    label: "Start Practice",
    icon: "🧩",
    title: "Practice Questions",
    description: "Choose a topic and start coding. Counts toward your streak.",
  },
  homework: {
    route: "/homework",
    label: "Open Homework",
    icon: "📚",
    title: "Homework",
    description: "See incomplete, submitted and reviewed work.",
  },
  assignments: {
    route: "/assignments",
    label: "View Assignments",
    icon: "📝",
    title: "Assignments",
    description: "Track your teacher-assigned tasks and deadlines.",
  },
  mockTests: {
    route: "/mock-tests",
    label: "View Mock Tests",
    icon: "🧪",
    title: "Mock Tests",
    description: "Pick a standard or AI-generated mock test to attempt.",
  },
  scheduledMockTests: {
    route: "/mock-tests",
    hash: "scheduled",
    label: "Open Scheduled Tests",
    icon: "📅",
    title: "Scheduled Mock Tests",
    description: "See upcoming, live and completed scheduled tests.",
  },
  notifications: {
    route: "/notifications",
    label: "Open Notifications",
    icon: "🔔",
    title: "Notifications",
    description: "Latest announcements and activity from your teachers.",
  },
  profile: {
    route: "/profile",
    label: "Open Profile",
    icon: "👤",
    title: "Your Profile",
    description: "Manage your profile, reports and account settings.",
  },
  leaderboard: {
    route: "/leaderboard",
    label: "View Leaderboard",
    icon: "🏆",
    title: "Leaderboard",
    description: "See where you rank in scheduled mock tests.",
  },
  streakJourney: {
    route: "/streak-journey",
    label: "View Streak Journey",
    icon: "🔥",
    title: "Streak Journey",
    description: "Track your daily streak and upcoming milestones.",
  },
  badges: {
    route: "/profile",
    hash: "badges",
    label: "View Badges",
    icon: "🏅",
    title: "Your Badges",
    description: "See earned badges and what to unlock next.",
  },
  help: {
    route: "/help",
    label: "Open Help",
    icon: "❓",
    title: "Help Center",
    description: "Guides and answers for using PY Kidda.",
  },
  adminHomework: {
    route: "/admin/homework",
    label: "Open Homework Management",
    icon: "🛠",
    title: "Homework Management",
    description: "Create, publish and grade homework.",
    adminOnly: true,
  },
  adminPractice: {
    route: "/admin/practice",
    label: "Open Practice Admin",
    icon: "🛠",
    title: "Practice Admin",
    description: "Manage practice questions and units.",
    adminOnly: true,
  },
  adminAssignments: {
    route: "/admin/assignments",
    label: "Open Assignments Admin",
    icon: "🛠",
    title: "Assignments Admin",
    description: "Create and manage assignments.",
    adminOnly: true,
  },
};

export const PykoActionSchema = z.object({
  type: z.literal("navigate"),
  routeKey: z.enum(PYKO_ROUTE_KEYS),
  label: z.string().min(1).max(60).optional(),
  style: z.enum(["primary", "secondary"]).default("primary"),
});
export type PykoAction = z.infer<typeof PykoActionSchema>;

export const PykoActionsBlockSchema = z.array(PykoActionSchema).min(1).max(3);

const ACTIONS_FENCE_RE = /```pyko-actions\s*\n([\s\S]*?)\n```/;

/** Extract and validate a pyko-actions JSON block. Removes it from content. */
export function extractPykoActions(raw: string): {
  actions: PykoAction[];
  cleaned: string;
} {
  if (!raw) return { actions: [], cleaned: raw };
  const m = raw.match(ACTIONS_FENCE_RE);
  if (!m || m.index === undefined) return { actions: [], cleaned: raw };
  try {
    const parsed = JSON.parse(m[1]);
    const actions = PykoActionsBlockSchema.parse(parsed);
    const cleaned = (raw.slice(0, m.index) + raw.slice(m.index + m[0].length)).trim();
    return { actions, cleaned };
  } catch {
    return { actions: [], cleaned: raw };
  }
}

/** Build the raw fenced block the server appends to assistant content. */
export function serializePykoActions(actions: PykoAction[]): string {
  return "```pyko-actions\n" + JSON.stringify(actions) + "\n```";
}

/**
 * Deterministic mapping from a user message to a primary + secondary
 * navigation intent. Returns [] when nothing matches. Never returns
 * admin routes; callers upgrade to admin variants server-side after
 * verifying the role.
 */
export function detectNavigationActions(message: string): PykoAction[] {
  const intent = resolveIntent(message);
  const topic = intent.topic;
  const lower = message.toLowerCase();

  const mkPrimary = (routeKey: PykoRouteKey): PykoAction => ({
    type: "navigate",
    routeKey,
    style: "primary",
    label: PYKO_NAVIGATION_ROUTES[routeKey].label,
  });
  const mkSecondary = (routeKey: PykoRouteKey): PykoAction => ({
    type: "navigate",
    routeKey,
    style: "secondary",
    label: PYKO_NAVIGATION_ROUTES[routeKey].label,
  });

  const topicToKey: Partial<Record<GuideTopic, PykoRouteKey>> = {
    practice: "practice",
    homework: "homework",
    assignment: "assignments",
    mock_test: "mockTests",
    ai_mock: "mockTests",
    scheduled_mock: "scheduledMockTests",
    notification: "notifications",
    profile: "profile",
    leaderboard: "leaderboard",
    streak: "streakJourney",
    badge: "badges",
    help: "help",
  };

  let primary: PykoRouteKey | null = topic ? topicToKey[topic] ?? null : null;

  // Extra keyword sniffing for phrases the topic resolver misses.
  if (!primary) {
    if (/\b(rank|ranking|rankings|leaderboard)\b/.test(lower)) primary = "leaderboard";
    else if (/\b(streak|streaks)\b/.test(lower)) primary = "streakJourney";
    else if (/\b(badge|badges|achievement|achievements)\b/.test(lower)) primary = "badges";
    else if (/\bcode|coding|solve.*question|start coding\b/.test(lower)) primary = "practice";
  }

  if (!primary) return [];

  const actions: PykoAction[] = [mkPrimary(primary)];

  // Sensible secondary pairings.
  const secondaryByPrimary: Partial<Record<PykoRouteKey, PykoRouteKey>> = {
    practice: "streakJourney",
    homework: "notifications",
    mockTests: "help",
    scheduledMockTests: "notifications",
    assignments: "notifications",
    streakJourney: "badges",
    badges: "streakJourney",
    leaderboard: "streakJourney",
  };
  const sec = secondaryByPrimary[primary];
  if (sec && sec !== primary) actions.push(mkSecondary(sec));

  return actions;
}

/** Role-based filter: strip admin routes for non-admins; upgrade for admins. */
export function filterActionsForRole(
  actions: PykoAction[],
  role: "student" | "teacher" | "admin" | "super_admin",
): PykoAction[] {
  const isAdmin = role === "admin" || role === "super_admin" || role === "teacher";
  const upgradeForAdmin: Partial<Record<PykoRouteKey, PykoRouteKey>> = {
    homework: "adminHomework",
  };
  return actions
    .map((a) => {
      const entry = PYKO_NAVIGATION_ROUTES[a.routeKey];
      if (entry.adminOnly && !isAdmin) return null;
      if (isAdmin && upgradeForAdmin[a.routeKey]) {
        const nk = upgradeForAdmin[a.routeKey] as PykoRouteKey;
        return { ...a, routeKey: nk, label: PYKO_NAVIGATION_ROUTES[nk].label };
      }
      return a;
    })
    .filter((a): a is PykoAction => a !== null);
}

/**
 * Detect admin-creation intent (e.g. "how do I create homework"). If the
 * caller is an admin/teacher we upgrade the primary action to the admin
 * management route. Students still receive the student route.
 */
export function isAdminCreationIntent(message: string): boolean {
  const intent = resolveIntent(message);
  const createish =
    intent.action === "create" ||
    intent.action === "assign" ||
    intent.action === "publish" ||
    intent.action === "schedule";
  return createish && (intent.topic === "homework" || intent.topic === "assignment" || intent.topic === "practice");
}
