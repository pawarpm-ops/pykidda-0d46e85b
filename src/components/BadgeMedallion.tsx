import {
  Rocket, Terminal, CheckCircle2, ClipboardCheck, ClipboardList,
  Sparkles, Flame, Zap, Shield, Crown, Sprout, Compass, Target, Trophy,
  Award, Flag, Map, Wand2, CheckCheck, Medal, Bug, Search, Heart, Undo2,
  TrendingUp, Star, Clock, ShieldCheck, RefreshCcw, ListChecks, Play,
  Brain, BookOpenCheck, GraduationCap, Swords, Mountain, Layers, Clock8,
  Lock, HelpCircle, type LucideIcon,
} from "lucide-react";
import { TIER_STYLES, type BadgeTier } from "@/lib/badges";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Rocket, Terminal, CheckCircle2, ClipboardCheck, ClipboardList,
  Sparkles, Flame, Zap, Shield, Crown, Sprout, Compass, Target, Trophy,
  Award, Flag, Map, Wand2, CheckCheck, Medal, Bug, Search, Heart, Undo2,
  TrendingUp, Star, Clock, ShieldCheck, RefreshCcw, ListChecks, Play,
  Brain, BookOpenCheck, GraduationCap, Swords, Mountain, Layers, Clock8,
};

export function BadgeMedallion({
  icon, tier, earned, isSecret, size = "md",
}: {
  icon: string;
  tier: BadgeTier;
  earned: boolean;
  isSecret?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICONS[icon] ?? Award;
  const t = TIER_STYLES[tier];
  const dim =
    size === "lg" ? "h-20 w-20" : size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const iconDim =
    size === "lg" ? "h-9 w-9" : size === "sm" ? "h-5 w-5" : "h-6 w-6";

  const showLocked = !earned && !isSecret;
  const showSecret = !earned && isSecret;

  return (
    <div
      aria-hidden
      className={cn(
        "relative inline-flex items-center justify-center rounded-full ring-2 shadow-md",
        dim,
        t.ring,
        earned
          ? `bg-gradient-to-br ${t.gradient} text-white`
          : "bg-muted text-muted-foreground grayscale opacity-70",
      )}
    >
      {/* inner enamel disk */}
      <div
        className={cn(
          "absolute inset-1 rounded-full",
          earned ? "bg-black/10 dark:bg-black/20" : "bg-background/40",
        )}
      />
      <div className="relative z-10">
        {showLocked ? (
          <Lock className={iconDim} />
        ) : showSecret ? (
          <HelpCircle className={iconDim} />
        ) : (
          <Icon className={iconDim} />
        )}
      </div>
    </div>
  );
}
