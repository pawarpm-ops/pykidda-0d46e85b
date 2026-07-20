// Pyko AI — structured intent resolver.
// Client-safe: no server-only imports. Used by Guide walkthrough lookup and
// the All-Rounder classifier so both share one paraphrase-tolerant matcher.
//
// Design:
//   1. Tokenise the user message with a MINIMAL stopword list — we only strip
//      articles, pronouns, wh-words and politeness fillers. Real action verbs
//      like "make", "give", "get", "use", "submit", "open" are KEPT.
//   2. Detect a GuideTopic from noun tokens (homework, practice, mock…).
//   3. Detect a GuideAction from verb tokens (create, submit, grade, open…).
//   4. Downstream code picks a walkthrough or short answer from the pair.

export type GuideTopic =
  | "homework"
  | "practice"
  | "assignment"
  | "mock_test"
  | "scheduled_mock"
  | "ai_mock"
  | "streak"
  | "badge"
  | "leaderboard"
  | "notification"
  | "profile"
  | "teacher_comment"
  | "analytics"
  | "help"
  | "auth"
  | "admin";

export type GuideAction =
  | "navigate"
  | "create"
  | "assign"
  | "publish"
  | "open"
  | "submit"
  | "grade"
  | "return"
  | "explain"
  | "delete"
  | "schedule"
  | "attempt"
  | "review"
  | "unknown";

export type GuideIntent = {
  topic: GuideTopic | null;
  action: GuideAction;
  normalized: string;
  tokens: string[];
};

// Only genuine filler words. NEVER include action verbs (make, get, give,
// use, submit, open, view, show, tell, need, want, add, prepare, publish,
// solve, check, review, grade, return, delete, schedule, attempt, create,
// assign, find, explain). Removing those breaks intent detection.
const STOPWORDS = new Set([
  // Articles / determiners
  "a", "an", "the", "this", "that", "these", "those", "any", "some",
  // Pronouns
  "i", "me", "my", "mine", "we", "our", "ours", "you", "your", "yours", "us", "it", "its",
  // Copulas & auxiliaries
  "is", "am", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "doing", "done",
  "has", "have", "had", "having",
  // Modals
  "can", "could", "should", "would", "will", "shall", "may", "might", "must",
  // Prepositions & conjunctions
  "to", "of", "for", "on", "in", "at", "by", "with", "from", "into", "about", "as",
  "and", "or", "but", "if", "then", "so", "because", "than",
  // Wh-words (kept out of intent — we infer navigation from topic + no verb)
  "how", "what", "why", "when", "where", "which", "who", "whom", "whose",
  // Politeness / fillers
  "please", "pls", "plz", "kindly", "hey", "hi", "hello", "pyko",
  "just", "also", "actually", "really", "okay", "ok", "thanks", "thx", "thank",
  // Weak helpers that never disambiguate
  "here", "there",
]);

// Verb → canonical GuideAction. Includes common inflections.
const ACTION_LEXICON: Record<string, GuideAction> = {
  // create-family
  create: "create", creating: "create", created: "create",
  make: "create", making: "create", made: "create",
  add: "create", adding: "create", added: "create",
  new: "create",
  prepare: "create", preparing: "create",
  build: "create", building: "create",
  set: "create", setup: "create",
  give: "assign", giving: "assign", gave: "assign",
  assign: "assign", assigning: "assign", assigned: "assign",
  publish: "publish", publishing: "publish", published: "publish",
  release: "publish", releasing: "publish",
  // open / view / find (navigate-ish)
  open: "open", opening: "open", opened: "open",
  view: "open", viewing: "open", viewed: "open",
  see: "open", seeing: "open", seen: "open", show: "open", showing: "open",
  find: "open", finding: "open", found: "open",
  goto: "open", go: "open", navigate: "open", access: "open", visit: "open",
  get: "open", getting: "open",
  use: "open", using: "open",
  // submit / attempt / solve
  submit: "submit", submitting: "submit", submitted: "submit",
  turn: "submit", hand: "submit", upload: "submit", send: "submit",
  solve: "attempt", solving: "attempt", solved: "attempt",
  attempt: "attempt", attempting: "attempt", attempted: "attempt", try: "attempt", take: "attempt", taking: "attempt", taken: "attempt",
  answer: "attempt", answering: "attempt",
  // grade / review / return
  grade: "grade", grading: "grade", graded: "grade",
  mark: "grade", marking: "grade", marked: "grade",
  check: "grade", checking: "grade", checked: "grade",
  review: "review", reviewing: "review", reviewed: "review",
  return: "return", returning: "return", returned: "return", reject: "return",
  // delete / schedule / explain
  delete: "delete", deleting: "delete", removed: "delete", remove: "delete", clear: "delete",
  schedule: "schedule", scheduling: "schedule", scheduled: "schedule",
  explain: "explain", explaining: "explain", explained: "explain",
  understand: "explain", teach: "explain", learn: "explain", meaning: "explain", definition: "explain", tell: "explain",
};

// Topic detection: single tokens OR two-word phrases. Checked longest-first
// so "scheduled mock" wins over "mock".
const TOPIC_PHRASES: Array<[string, GuideTopic]> = [
  ["scheduled mock", "scheduled_mock"],
  ["scheduled test", "scheduled_mock"],
  ["ai mock", "ai_mock"],
  ["ai test", "ai_mock"],
  ["mock test", "mock_test"],
  ["teacher comment", "teacher_comment"],
  ["teacher feedback", "teacher_comment"],
  ["mock", "mock_test"],
  ["homework", "homework"],
  ["hw", "homework"],
  ["assignment", "assignment"],
  ["assignments", "assignment"],
  ["practice", "practice"],
  ["question", "practice"], // "practice question" already captured above; bare "question" leans practice
  ["streak", "streak"],
  ["streaks", "streak"],
  ["badge", "badge"],
  ["badges", "badge"],
  ["leaderboard", "leaderboard"],
  ["rank", "leaderboard"],
  ["ranking", "leaderboard"],
  ["notification", "notification"],
  ["notifications", "notification"],
  ["announcement", "notification"],
  ["announcements", "notification"],
  ["profile", "profile"],
  ["analytics", "analytics"],
  ["stats", "analytics"],
  ["report", "analytics"],
  ["reports", "analytics"],
  ["help", "help"],
  ["tutorial", "help"],
  ["auth", "auth"],
  ["sign", "auth"], // sign in / sign up
  ["login", "auth"],
  ["signup", "auth"],
  ["admin", "admin"],
];

const PUNCT_RE = /[`~!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g;

// Controlled spelling / synonym correction. ONLY maps tokens to a known PY
// Kidda topic or action verb — never rewrites arbitrary words. This bounds
// fuzzy behaviour so we don't accidentally warp real Python vocabulary.
const SPELLING_MAP: Record<string, string> = {
  // homework typos
  hoemwork: "homework", homwork: "homework", homewrk: "homework", homeework: "homework",
  hwrk: "homework", hw: "homework",
  // practice typos
  practise: "practice", pratice: "practice", practce: "practice", practicee: "practice",
  // assignment typos
  assingment: "assignment", assinment: "assignment", assignmnt: "assignment", assingments: "assignment",
  // mock / test / scheduled
  moc: "mock", moock: "mock", mck: "mock", tset: "test", tets: "test",
  sheduled: "scheduled", schedueld: "scheduled", scheduld: "scheduled", scheuled: "scheduled",
  // streak
  strek: "streak", streek: "streak", streakk: "streak",
  // badge / leaderboard / notification / profile
  bage: "badge", badg: "badge",
  leaderbord: "leaderboard", leadeboard: "leaderboard", leaderborad: "leaderboard",
  notifcation: "notification", notificaton: "notification", notifiction: "notification",
  profil: "profile", proflie: "profile",
  // action verbs — create family
  craete: "create", creaet: "create", creat: "create", creete: "create",
  mke: "make", mak: "make",
  prpare: "prepare", prepere: "prepare",
  ad: "add", addd: "add",
  asign: "assign", asisgn: "assign", assgn: "assign",
  publsh: "publish", pubish: "publish",
  // action verbs — submit / grade / return / delete
  sumbit: "submit", submt: "submit", sbumit: "submit",
  grde: "grade", gade: "grade",
  retun: "return", retrun: "return",
  delte: "delete", delet: "delete", dlete: "delete",
  // action verbs — open / view / find / explain
  opn: "open", oepn: "open",
  vew: "view", veiw: "view",
  fnd: "find", fidn: "find",
  explan: "explain", exlpain: "explain", explian: "explain",
  // wh-words (kept for correction, still stripped later)
  wher: "where", wehre: "where",
  // hw override handled above (hw → homework)
};

export function tokenizePyko(message: string): string[] {
  if (!message) return [];
  const cleaned = message.toLowerCase().replace(PUNCT_RE, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned
    .split(" ")
    .map((t) => SPELLING_MAP[t] ?? t)
    .filter((t) => t && !STOPWORDS.has(t));
}

export function resolveIntent(message: string): GuideIntent {
  const tokens = tokenizePyko(message);
  const normalized = tokens.join(" ");

  // Topic: prefer longest phrase match.
  let topic: GuideTopic | null = null;
  for (const [phrase, t] of TOPIC_PHRASES) {
    if (!phrase.includes(" ")) continue;
    if (normalized.includes(phrase)) { topic = t; break; }
  }
  if (!topic) {
    for (const [phrase, t] of TOPIC_PHRASES) {
      if (phrase.includes(" ")) continue;
      if (tokens.includes(phrase)) { topic = t; break; }
    }
  }

  // Action: first verb-like token that maps to the lexicon.
  let action: GuideAction = "unknown";
  for (const tok of tokens) {
    const mapped = ACTION_LEXICON[tok];
    if (mapped) { action = mapped; break; }
  }

  // If the message clearly starts with a wh-word about a topic and no verb,
  // treat it as navigation ("where is homework", "what is streak").
  if (action === "unknown") {
    const rawLower = message.toLowerCase();
    if (/\b(where|show me|find|locate)\b/.test(rawLower) && topic) action = "navigate";
    else if (/\b(what|explain|define|meaning)\b/.test(rawLower)) action = "explain";
  }

  return { topic, action, normalized, tokens };
}

// Convenience: does this intent look like a request to CREATE something?
// (Used by both Guide walkthrough lookup and All-Rounder classifier.)
export function isCreateIntent(intent: GuideIntent): boolean {
  return intent.action === "create" || intent.action === "assign" || intent.action === "publish" || intent.action === "schedule";
}
