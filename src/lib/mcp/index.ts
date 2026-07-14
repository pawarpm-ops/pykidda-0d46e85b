import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import getMyStreak from "./tools/get-my-streak";
import listMyPracticeAttempts from "./tools/list-my-practice-attempts";
import listMyAssignments from "./tools/list-my-assignments";
import listMyHomework from "./tools/list-my-homework";

// The OAuth issuer must be the direct Supabase host; the runtime SUPABASE_URL
// gets rewritten to the `.lovable.cloud` proxy on publish, which mcp-js rejects
// (RFC 8414 issuer mismatch). VITE_SUPABASE_PROJECT_ID is a build-time literal
// that survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pykidda-mcp",
  title: "PY Kidda",
  version: "0.1.0",
  instructions:
    "Read the signed-in PY Kidda student's profile, daily streak, practice attempts, assignments, and homework. All tools are read-only and scoped to the authenticated user by RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyProfile,
    getMyStreak,
    listMyPracticeAttempts,
    listMyAssignments,
    listMyHomework,
  ],
});
