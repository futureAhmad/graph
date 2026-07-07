import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-card/80 p-4 text-card-foreground shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur",
        className
      )}
      {...props}
    />
  );
}
