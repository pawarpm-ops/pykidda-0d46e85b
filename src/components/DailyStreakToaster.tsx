import { useEffect } from "react";
import { toast } from "sonner";
import { Flame } from "lucide-react";

/**
 * Global listener that fires a lightweight toast the first time the student
 * earns their daily streak by opening an eligible activity (Homework,
 * Practice question, Mock Test, or Scheduled Mock Test).
 */
export function DailyStreakToaster() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ current_streak: number }>).detail;
      const streak = detail?.current_streak ?? 0;
      toast.success(`🔥 Daily streak counted! You're on a ${streak}-day streak.`, {
        duration: 5000,
        icon: <Flame className="h-5 w-5 text-orange-500" />,
      });
    };
    window.addEventListener("pk:daily-streak-counted", handler);
    return () => window.removeEventListener("pk:daily-streak-counted", handler);
  }, []);
  return null;
}
