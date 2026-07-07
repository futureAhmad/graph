"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "16.25rem";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider.");
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(true);

  return <SidebarContext.Provider value={{ open, setOpen, collapsed, setCollapsed }}>{children}</SidebarContext.Provider>;
}

export function Sidebar({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen, collapsed } = useSidebar();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        data-collapsed={collapsed}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] -translate-x-full flex-col border-r border-border bg-card/95 p-3 shadow-2xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:bg-card/75 lg:shadow-none lg:backdrop-blur-xl",
          collapsed && "lg:w-[4.75rem] lg:items-center",
          open && "translate-x-0",
          className
        )}
        style={{ "--sidebar-width": SIDEBAR_WIDTH } as React.CSSProperties}
      >
        {children}
      </aside>
    </>
  );
}

export function SidebarInset({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 flex-1", className)}>{children}</div>;
}

export function SidebarHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-1 pb-5 pt-1", className)}>{children}</div>;
}

export function SidebarContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden", className)}>{children}</div>;
}

export function SidebarFooter({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto pt-5", className)}>{children}</div>;
}

export function SidebarGroup({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)}>{children}</div>;
}

export function SidebarGroupLabel({ className, children }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("sidebar-label px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}>{children}</p>;
}

export function SidebarMenu({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)}>{children}</div>;
}

export function SidebarMenuButton({
  className,
  active,
  asChild,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      className={cn(
        "sidebar-menu-button flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "border border-primary/25 bg-primary/15 text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { collapsed, setCollapsed, setOpen } = useSidebar();

  return (
    <Button
      className={cn("h-9 w-9 p-0", className)}
      variant="ghost"
      onClick={() => {
        setOpen(true);
        setCollapsed(!collapsed);
      }}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <PanelLeft className="h-5 w-5 lg:hidden" />
      {collapsed ? <PanelLeftOpen className="hidden h-5 w-5 lg:block" /> : <PanelLeftClose className="hidden h-5 w-5 lg:block" />}
    </Button>
  );
}
