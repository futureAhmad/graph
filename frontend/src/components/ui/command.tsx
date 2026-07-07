"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandOption {
  label: string;
  value: string;
}

interface CommandSelectProps {
  options: CommandOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

export function CommandSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyText = "No results found."
}: CommandSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-left text-sm text-foreground transition-colors hover:bg-white/[0.07]"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-full overflow-hidden rounded-md border border-white/10 bg-[#061126] shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <div className="flex h-10 items-center gap-2 border-b border-white/10 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors hover:bg-white/[0.07]"
                  onClick={() => {
                    onValueChange(option.value);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
