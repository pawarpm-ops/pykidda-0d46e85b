import { useEffect } from "react";
import { toast } from "sonner";
import { Award } from "lucide-react";
import type { AwardedBadge } from "@/lib/badges";

/**
 * Global listener that fires a celebration toast whenever a new badge is awarded.
 * Mounted once inside the authenticated shell.
 */
export function BadgeToaster() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AwardedBadge>).detail;
      if (!detail) return;
      toast.success(`🏆 Badge unlocked: ${detail.badge_name}`, {
        description: detail.description,
        duration: 6000,
        action: {
          label: "View",
          onClick: () => {
            if (typeof window !== "undefined") window.location.href = "/profile";
          },
        },
        icon: <Award className="h-5 w-5 text-amber-500" />,
      });
    };
    window.addEventListener("pk:badge-earned", handler);
    return () => window.removeEventListener("pk:badge-earned", handler);
  }, []);
  return null;
}
