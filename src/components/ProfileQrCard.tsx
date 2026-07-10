import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { publicProfileUrl } from "@/lib/publicProfile";

type Props = {
  publicId: string;
  displayName: string;
  enabled: boolean;
};

export function ProfileQrCard({ publicId, displayName, enabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const url = publicProfileUrl(publicId);

  useEffect(() => {
    if (!canvasRef.current || !enabled) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1e3f", light: "#ffffff" },
    }).catch(() => {});
    QRCode.toDataURL(url, {
      width: 720,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1e3f", light: "#ffffff" },
    })
      .then(setPngUrl)
      .catch(() => setPngUrl(null));
  }, [url, enabled]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public profile link copied");
    } catch {
      toast.error("Couldn't copy — long-press to select manually");
    }
  }

  function downloadPng() {
    if (!pngUrl) return;
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `${displayName || "py-kidda"}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-warm)]">
        <h2 className="text-lg font-bold">My Profile QR Code</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your public QR profile is currently <span className="font-semibold text-foreground">off</span>. Turn it on in the
          Public profile settings below to share your Python learning card.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border p-6 text-primary-foreground shadow-[var(--shadow-warm)]"
      style={{
        backgroundImage:
          "radial-gradient(120% 90% at 100% 0%, oklch(0.72 0.16 55 / 0.35), transparent 60%), radial-gradient(90% 80% at 0% 100%, oklch(0.55 0.14 210 / 0.4), transparent 60%), linear-gradient(135deg, oklch(0.22 0.06 260), oklch(0.32 0.09 240))",
      }}
    >
      <div
        className="pointer-events-none absolute -inset-8 -z-0 rounded-full opacity-30 blur-3xl"
        style={{ backgroundImage: "var(--gradient-sunrise)" }}
      />
      <div className="relative z-10 flex flex-wrap items-start gap-6">
        <div className="rounded-2xl bg-white p-3 shadow-lg">
          <canvas ref={canvasRef} className="block h-[240px] w-[240px]" aria-label="Public profile QR code" />
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
              🛡️ Public profile · Safe view
            </span>
          </div>
          <h2 className="text-2xl font-black leading-tight">My Profile QR Code</h2>
          <p className="text-sm text-white/80">
            Scan my Python learning profile — no email, phone, or personal info is ever shown.
          </p>
          <div className="mt-1 rounded-lg bg-black/30 px-3 py-2 text-xs text-white/90 break-all">
            {url}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!pngUrl}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-[oklch(0.22_0.06_260)] hover:bg-white/90 disabled:opacity-50"
            >
              ⬇ Download QR
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              🔗 Copy link
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              👀 Preview
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
