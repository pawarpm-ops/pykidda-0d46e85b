import { useEffect, useState } from "react";
import type { StreakRank } from "@/lib/streaks";

export function StreakUnlockModal() {
  const [rank, setRank] = useState<StreakRank | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        unlocked_rank: StreakRank | null;
        current_streak: number;
      };
      if (detail?.unlocked_rank) {
        setRank(detail.unlocked_rank);
        setStreak(detail.current_streak);
      }
    };
    window.addEventListener("pk:streak-updated", handler);
    return () => window.removeEventListener("pk:streak-updated", handler);
  }, []);

  if (!rank) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <style>{`
        @keyframes pk-pop { 0%{transform:scale(.3) rotate(-20deg);opacity:0} 60%{transform:scale(1.1) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
        @keyframes pk-spin-slow { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes pk-conf { 0%{transform:translateY(-20px) rotate(0);opacity:1} 100%{transform:translateY(300px) rotate(720deg);opacity:0} }
      `}</style>
      {/* confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <span
            key={i}
            className="absolute top-0 text-2xl"
            style={{
              left: `${(i * 7) % 100}%`,
              animation: `pk-conf ${2 + (i % 4) * 0.5}s ease-in ${(i % 6) * 0.1}s infinite`,
            }}
          >
            {["🎉", "✨", "⭐", "🔥", "🐍"][i % 5]}
          </span>
        ))}
      </div>

      <div
        className="relative w-full max-w-md rounded-3xl border border-white/20 bg-slate-900/90 p-8 text-center shadow-2xl"
        style={{ animation: "pk-pop .7s cubic-bezier(.34,1.56,.64,1) both" }}
      >
        <div
          className="absolute -inset-1 -z-10 rounded-3xl blur-2xl opacity-70"
          style={{ background: rank.color }}
        />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-300">Rank Unlocked!</p>
        <div className="mx-auto my-6 flex h-32 w-32 items-center justify-center rounded-full text-6xl shadow-2xl"
          style={{ background: rank.color, animation: "pk-spin-slow 8s linear infinite" }}
        >
          <span style={{ display: "inline-block", animation: "pk-spin-slow 8s linear infinite reverse" }}>
            {rank.icon}
          </span>
        </div>
        <h2 className="text-3xl font-black text-white">{rank.name}</h2>
        <p className="mt-2 text-white/80">
          🔥 <span className="font-bold text-yellow-300">{streak} day streak</span> — you're on fire!
        </p>
        <button
          onClick={() => setRank(null)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:scale-105"
        >
          View My Badge 🏆
        </button>
      </div>
    </div>
  );
}
