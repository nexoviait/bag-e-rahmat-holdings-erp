import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import { fmtDate } from "@/lib/format";

type DatePickerProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  showTime?: boolean;
  required?: boolean;
  disabled?: boolean;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
  showTime = false,
  required = false,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");
  const [popoverOffset, setPopoverOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const POPOVER_WIDTH = 288; // matches w-72

  function toggleOpen() {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - POPOVER_WIDTH - margin);
      const clampedViewportLeft = Math.min(Math.max(rect.left, margin), maxLeft);
      setPopoverOffset(clampedViewportLeft - rect.left);
    }
    setOpen((o) => !o);
    setViewMode("days");
  }

  // Parse initial date
  const parseVal = (v: string) => {
    if (!v) return new Date();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [viewDate, setViewDate] = useState(() => parseVal(value));
  const [selectedTime, setSelectedTime] = useState(() => {
    if (showTime && value && value.includes("T")) {
      return value.split("T")[1].slice(0, 5);
    }
    return "12:00";
  });

  useEffect(() => {
    if (value) {
      const d = parseVal(value);
      setViewDate(d);
      if (showTime && value.includes("T")) {
        setSelectedTime(value.split("T")[1].slice(0, 5));
      }
    }
  }, [value, showTime]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setViewMode("days");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Days in month calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const handleSelectDay = (day: number) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    let formatted = `${year}-${mm}-${dd}`;
    if (showTime) {
      formatted += `T${selectedTime}`;
    }
    onChange(formatted);
    if (!showTime) {
      setOpen(false);
      setViewMode("days");
    }
  };

  const handleTimeChange = (t: string) => {
    setSelectedTime(t);
    if (value) {
      const datePart = value.split("T")[0];
      onChange(`${datePart}T${t}`);
    }
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const d = new Date(value);
    return (
      !isNaN(d.getTime()) &&
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  // Generate calendar days
  const calendarCells = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarCells.push({ day: daysInPrevMonth - i, monthType: "prev" });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({ day: i, monthType: "current" });
  }
  const remaining = 42 - calendarCells.length;
  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({ day: i, monthType: "next" });
  }

  // Display label
  const displayLabel = value
    ? showTime
      ? `${fmtDate(value.split("T")[0])} at ${selectedTime}`
      : fmtDate(value)
    : placeholder;

  const currentYearRange = Array.from({ length: 16 }, (_, i) => year - 7 + i);

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {/* Input Display Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition focus:border-gold hover:border-gold/50 cursor-pointer disabled:opacity-50 ${
          open ? "border-gold ring-1 ring-gold/40" : ""
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="h-4 w-4 flex-shrink-0 text-gold" />
          <span className={`truncate text-sm ${!value ? "text-muted-foreground" : "font-medium text-foreground"}`}>
            {displayLabel}
          </span>
        </div>
        {value ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            title="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>

      {/* Popover Calendar */}
      {open && (
        <div
          style={{ left: popoverOffset }}
          className="absolute z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface-1 p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-gold transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1 font-display text-sm font-semibold">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "months" ? "days" : "months")}
                className="rounded px-1.5 py-0.5 hover:bg-surface-2 hover:text-gold transition cursor-pointer"
              >
                {MONTH_NAMES[month]}
              </button>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "years" ? "days" : "years")}
                className="rounded px-1.5 py-0.5 hover:bg-surface-2 hover:text-gold transition cursor-pointer"
              >
                {year}
              </button>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-gold transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* VIEW MODE: MONTHS SELECTOR */}
          {viewMode === "months" && (
            <div className="grid grid-cols-3 gap-2 py-2">
              {SHORT_MONTHS.map((m, idx) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setViewDate(new Date(year, idx, 1));
                    setViewMode("days");
                  }}
                  className={`rounded-lg py-2 text-xs font-medium transition cursor-pointer ${
                    idx === month
                      ? "bg-gold text-primary-foreground font-bold shadow-gold"
                      : "text-foreground hover:bg-surface-2 hover:text-gold"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* VIEW MODE: YEARS SELECTOR */}
          {viewMode === "years" && (
            <div className="grid grid-cols-4 gap-2 py-2 max-h-48 overflow-y-auto">
              {currentYearRange.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewDate(new Date(y, month, 1));
                    setViewMode("days");
                  }}
                  className={`rounded-lg py-2 text-xs font-medium transition cursor-pointer ${
                    y === year
                      ? "bg-gold text-primary-foreground font-bold shadow-gold"
                      : "text-foreground hover:bg-surface-2 hover:text-gold"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* VIEW MODE: DAYS CALENDAR */}
          {viewMode === "days" && (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (cell.monthType !== "current") {
                    return (
                      <div
                        key={idx}
                        className="grid h-8 w-8 place-items-center text-xs text-muted-foreground/30 select-none"
                      >
                        {cell.day}
                      </div>
                    );
                  }
                  const selected = isSelected(cell.day);
                  const today = isToday(cell.day);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDay(cell.day)}
                      className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-medium transition cursor-pointer ${
                        selected
                          ? "bg-gold text-primary-foreground font-bold shadow-gold"
                          : today
                          ? "border border-gold text-gold font-semibold"
                          : "text-foreground hover:bg-surface-2 hover:text-gold"
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Time Picker Row if enabled */}
          {showTime && (
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-gold" /> Time:
              </div>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-gold"
              />
            </div>
          )}

          {/* Quick Actions Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const mm = String(today.getMonth() + 1).padStart(2, "0");
                const dd = String(today.getDate()).padStart(2, "0");
                let formatted = `${today.getFullYear()}-${mm}-${dd}`;
                if (showTime) formatted += `T${selectedTime}`;
                onChange(formatted);
                setOpen(false);
                setViewMode("days");
              }}
              className="text-[11px] font-medium text-gold hover:underline cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setViewMode("days");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
