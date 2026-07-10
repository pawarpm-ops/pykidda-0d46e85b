import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// value: "YYYY-MM-DDTHH:mm" (local); onChange emits same format.
export function DueDateTimePicker({
  value,
  onChange,
  disablePast = true,
}: {
  value: string;
  onChange: (v: string) => void;
  disablePast?: boolean;
}) {
  const parsed = React.useMemo(() => {
    if (!value) return { date: undefined as Date | undefined, time: "17:00" };
    const [d, t] = value.split("T");
    if (!d) return { date: undefined, time: "17:00" };
    const [y, m, day] = d.split("-").map(Number);
    return { date: new Date(y, (m ?? 1) - 1, day ?? 1), time: t?.slice(0, 5) || "17:00" };
  }, [value]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const emit = (date: Date | undefined, time: string) => {
    if (!date) return onChange("");
    onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const displayDate = parsed.date ? format(parsed.date, "d MMMM yyyy") : null;
  const displayTime = parsed.date
    ? format(new Date(`2000-01-01T${parsed.time}`), "hh:mm a")
    : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-10 w-full justify-start rounded-md border-border bg-background text-left font-normal",
                !parsed.date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
              {parsed.date ? format(parsed.date, "PPP") : <span>Pick due date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-xl border-border bg-popover p-0 shadow-lg" align="start">
            <Calendar
              mode="single"
              selected={parsed.date}
              onSelect={(d) => emit(d ?? undefined, parsed.time)}
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
            value={parsed.time}
            onChange={(e) => emit(parsed.date, e.target.value || "00:00")}
            className="h-10 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 sm:w-40"
          />
        </div>
      </div>

      {parsed.date ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
          <div className="font-semibold text-primary">Selected due date & time</div>
          <div className="mt-0.5">
            Due Date: <span className="font-medium">{displayDate}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            Due Time: <span className="font-medium">{displayTime}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Please select homework due date and time.</p>
      )}
    </div>
  );
}
