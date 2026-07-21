import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  NotebookPen,
  ClipboardList,
  Flame,
  Trophy,
  Code2,
  UserCog,
  Search,
  LifeBuoy,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — Py Kidda Hub" },
      {
        name: "description",
        content:
          "Student help center for Py Kidda Hub. Learn how to attempt homework, take mock tests, understand streaks, check results, and fix common code issues.",
      },
      { property: "og:title", content: "Help & FAQ — Py Kidda Hub" },
      {
        property: "og:description",
        content:
          "Quick answers about homework, mock tests, streaks, results and coding help.",
      },
    ],
  }),
  component: HelpPage,
});

type Category =
  | "Homework"
  | "Mock Test"
  | "Streak"
  | "Results"
  | "Coding Help"
  | "Account/Profile";

type FaqItem = {
  id: string;
  category: Category;
  q: string;
  a: React.ReactNode;
};

const CATEGORIES: { key: Category; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "Homework", icon: NotebookPen },
  { key: "Mock Test", icon: ClipboardList },
  { key: "Streak", icon: Flame },
  { key: "Results", icon: Trophy },
  { key: "Coding Help", icon: Code2 },
  { key: "Account/Profile", icon: UserCog },
];

const FAQS: FaqItem[] = [
  {
    id: "hw-attempt",
    category: "Homework",
    q: "How do I attempt homework?",
    a: (
      <div className="space-y-2">
        <p>Open the <b>Homework</b> tab from the sidebar. You will see two lists:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Incomplete</b> — homework you still need to submit.</li>
          <li><b>Completed</b> — homework you have already submitted.</li>
        </ul>
        <p>Click any incomplete homework to open it, read each question, type your answer or code, and click <b>Submit</b>. After submission, it moves to the Completed list.</p>
      </div>
    ),
  },
  {
    id: "hw-late",
    category: "Homework",
    q: "What is a late submission?",
    a: (
      <p>
        If your teacher allows late submissions, you can still submit homework
        after the due time. It will be tagged as <b>Submitted Late</b> so the
        teacher can see it was late, and it will still move to your Completed
        list.
      </p>
    ),
  },
  {
    id: "mock-attend",
    category: "Mock Test",
    q: "How do I attend a mock test?",
    a: (
      <div className="space-y-2">
        <p>Go to <b>Mock Tests</b> from the sidebar. There are two types:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Normal Mock Test</b> — you can start any time.</li>
          <li><b>Scheduled Mock Test</b> — opens only at the time your teacher sets.</li>
        </ul>
        <p>Click <b>Start Test</b> to begin. Some tests use <b>Secure Mode</b> — the test must stay in fullscreen and only the keyboard is allowed. Leaving fullscreen or switching tabs may end your test.</p>
        <p>After you submit, your answers are locked and saved for review.</p>
      </div>
    ),
  },
  {
    id: "streak",
    category: "Streak",
    q: "What is a streak?",
    a: (
      <div className="space-y-2">
        <p>Your <b>streak</b> shows how many days in a row you have been active on Py Kidda Hub. Activities that count include:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submitting homework</li>
          <li>Taking a mock test</li>
          <li>Practicing coding questions</li>
        </ul>
        <p>If you miss a day, your streak resets to 0. Your current streak is shown on your Dashboard and Profile.</p>
      </div>
    ),
  },
  {
    id: "results",
    category: "Results",
    q: "How do I check my results?",
    a: (
      <div className="space-y-2">
        <p><b>Mock test results</b> appear on the mock test page after you submit (or when your teacher releases them). Look for score, grade and any feedback.</p>
        <p><b>Homework marks and feedback</b> are shown inside the completed homework once your teacher grades it.</p>
        <p>If the result is not visible yet, your teacher may release it later.</p>
      </div>
    ),
  },
  {
    id: "code-not-running",
    category: "Coding Help",
    q: "My code is not running. What should I do?",
    a: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Check your <b>syntax</b> (missing colon, bracket or quote).</li>
        <li>Check your <b>indentation</b> — Python is strict about spaces.</li>
        <li>Match the <b>input / output format</b> from the question.</li>
        <li>Check your <b>internet connection</b>.</li>
        <li>Wait a few seconds — the <b>Python engine</b> may still be loading.</li>
        <li>Try again. If it still fails, use <b>Report a Problem</b>.</li>
      </ul>
    ),
  },
  {
    id: "profile",
    category: "Account/Profile",
    q: "How do I update my profile?",
    a: (
      <p>Open the <b>Profile</b> tab from the sidebar to update your display name and preferences. Your email is used to sign in and cannot be changed here.</p>
    ),
  },
];

const QUICK_CARDS: { title: string; desc: string; target: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { title: "Attempt Homework", desc: "How to open and submit homework", target: "hw-attempt", icon: NotebookPen },
  { title: "Attend Mock Test", desc: "Normal vs scheduled, secure mode", target: "mock-attend", icon: ClipboardList },
  { title: "Check Result", desc: "Where to see scores & feedback", target: "results", icon: Trophy },
  { title: "Code Not Running?", desc: "Fix common Python issues", target: "code-not-running", icon: Code2 },
  { title: "Streak Help", desc: "How streaks work", target: "streak", icon: Flame },
];

function HelpPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<Category | "All">("All");
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/" });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (activeCat !== "All" && f.category !== activeCat) return false;
      if (!q) return true;
      return (
        f.q.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [query, activeCat]);

  function jumpTo(id: string) {
    setActiveCat("All");
    setQuery("");
    setOpenItem(id);
    setTimeout(() => {
      const el = document.getElementById(`faq-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function openReport() {
    window.dispatchEvent(new CustomEvent("open-report-problem"));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          aria-label="Go back"
          title="Go back"
          className="mb-4 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          eyebrow="Support"
          title="Help & FAQ"
          description="Quick answers about homework, mock tests, streaks, results and coding. Search below or pick a category."
          icon={<HelpCircle className="h-5 w-5" />}
        />
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help topics…"
          className="pl-10 h-11"
          aria-label="Search help topics"
        />
      </div>

      {/* Quick cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {QUICK_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.target}
              type="button"
              onClick={() => jumpTo(c.target)}
              className="group text-left rounded-xl border border-border bg-card/60 p-4 hover:border-primary/50 hover:bg-card transition-colors"
            >
              <Icon className="h-5 w-5 text-primary mb-2" />
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveCat("All")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
            activeCat === "All"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border bg-background hover:border-primary/50",
          )}
        >
          All
        </button>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = activeCat === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCat(c.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background hover:border-primary/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.key}
            </button>
          );
        })}
      </div>

      {/* FAQ list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">No help topic found.</p>
        </div>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={openItem}
          onValueChange={setOpenItem}
          className="rounded-xl border border-border bg-card/60 divide-y divide-border"
        >
          {filtered.map((f) => (
            <AccordionItem
              key={f.id}
              value={f.id}
              id={`faq-${f.id}`}
              className="px-4 border-b-0 hover:bg-primary/[0.03] transition-colors"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
                    {f.category}
                  </Badge>
                  <span className="font-medium">{f.q}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pt-1 pb-4 pl-1">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Report problem CTA */}
      <div className="mt-10 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card/60 to-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <div>
            <div className="font-semibold">Still need help?</div>
            <p className="text-sm text-muted-foreground">
              Tell us what went wrong and our team will look into it.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openReport}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
          style={{
            backgroundImage:
              "linear-gradient(135deg,#f59e0b 0%,#ea580c 50%,#dc2626 100%)",
          }}
        >
          Report a problem
        </button>
      </div>
      </div>
    </div>
  );
}
