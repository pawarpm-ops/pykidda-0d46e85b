import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Reusable date + start/end time picker with the same premium look as DueDateTimePicker.
// date: "YYYY-MM-DD"   startTime/endTime: "HH:mm"
// When durationMinutes is provided, End Time becomes read-only and is auto-calculated
// from Start Time + duration. Parent still receives the computed end via onEndTimeChange.
export function DateTimeRangePicker({
  date,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  disablePast = true,
  durationMinutes,
}: {
  date: string;
  startTime: string;
  endTime: string;
  onDateChange: (v: string) => void;
  onStartTimeChange: (v: string) => void;
  onEndTimeChange: (v: string) => void;
  disablePast?: boolean;
  durationMinutes?: number;
}) {
  const parsedDate = React.useMemo(() => {
    if (!date) return undefined;
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  }, [date]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const emitDate = (d: Date | undefined) => {
    if (!d) return onDateChange("");
    onDateChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  const computeEnd = React.useCallback(
    (start: string): string => {
      if (!start || !durationMinutes) return "";
      const [h, m] = start.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
      const total = h * 60 + m + durationMinutes;
      const eh = Math.floor((total % (24 * 60)) / 60);
      const em = total % 60;
      return `${pad(eh)}:${pad(em)}`;
    },
    [durationMinutes],
  );

  // Keep endTime in sync when duration mode is on.
  React.useEffect(() => {
    if (!durationMinutes) return;
    const next = computeEnd(startTime);
    if (next && next !== endTime) onEndTimeChange(next);
  }, [durationMinutes, startTime, computeEnd, endTime, onEndTimeChange]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const displayDate = parsedDate ? format(parsedDate, "d MMMM yyyy") : null;
  const fmtTime = (t: string) =>
    t ? format(new Date(`2000-01-01T${t}`), "hh:mm a") : "—";

  const effectiveEnd = durationMinutes ? computeEnd(startTime) : endTime;
  const invalidRange =
    !durationMinutes && !!startTime && !!endTime && startTime >= endTime;

  const gridCols = durationMinutes ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <div className="space-y-2">
      <div className={cn("grid grid-cols-1 gap-2", gridCols)}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10 w-full justify-start rounded-md border-border bg-background text-left font-normal",
                !parsedDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
              {parsedDate ? format(parsedDate, "PPP") : <span>Pick date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-xl border-border bg-popover p-0 shadow-lg" align="start">
            <Calendar
              mode="single"
              selected={parsedDate}
              onSelect={(d) => emitDate(d ?? undefined)}
              disabled={disablePast ? { before: today } : undefined}
              initialFocus
              className={cn("p-3 pointer-events-auto rounded-xl")}
            />
          </PopoverContent>
        </Popover>

        <div className="relative">
          <Clock className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <input
            type="time"
            aria-label="Start time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value || "00:00")}
            className="h-10 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {!durationMinutes && (
          <div className="relative">
            <Clock className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <input
              type="time"
              aria-label="End time"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value || "00:00")}
              className="h-10 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}
      </div>

      {durationMinutes ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">End time (auto):</span>
          <span className="font-semibold">{effectiveEnd ? fmtTime(effectiveEnd) : "—"}</span>
          <span className="ml-auto text-muted-foreground">Duration: {durationMinutes} min</span>
        </div>
      ) : null}

      {parsedDate ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            invalidRange
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-primary/20 bg-primary/5 text-foreground",
          )}
        >
          <div className="font-semibold text-primary">Scheduled window</div>
          <div className="mt-0.5">
            Date: <span className="font-medium">{displayDate}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            Start: <span className="font-medium">{fmtTime(startTime)}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            End: <span className="font-medium">{fmtTime(effectiveEnd)}</span>
          </div>
          {invalidRange && (
            <div className="mt-1 text-destructive">End time must be after start time.</div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {durationMinutes ? "Please select date and start time." : "Please select date, start time and end time."}
        </p>
      )}
    </div>
  );
}
