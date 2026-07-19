"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  ChevronDown,
  GitBranch,
  LogIn,
  LogOut,
  PlusCircle,
  UploadCloud,
  Moon,
  Network,
  Search,
  Share2,
  ShieldCheck,
  Sun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/layout/auth-provider";
import { useTheme } from "@/components/layout/theme-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/explorer", label: "Services", icon: Network },
  { href: "/impact", label: "Impact Analysis", icon: GitBranch },
  { href: "/search", label: "Global Search", icon: Search },
  { href: "/import", label: "Import Data", icon: UploadCloud }
];

const adminNavItems = [
  { href: "/admin/users", label: "Users", icon: ShieldCheck },
  { href: "/admin/services", label: "Add Service", icon: PlusCircle }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const isLoginPage = pathname === "/login";
  const visibleNavItems = user?.role === "admin" ? [...navItems, ...adminNavItems] : navItems;

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user && !isLoginPage) {
      router.replace("/login");
      return;
    }
    if (user && isLoginPage) {
      router.replace(user.role === "admin" ? "/admin/users" : "/dashboard");
    }
  }, [isLoginPage, loading, router, user]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <Link href="/dashboard" className="flex items-center gap-3 px-1 font-semibold" title="Dependency Intelligence">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-sky-400/40 bg-sky-400/10 text-sky-300">
                <Share2 className="h-5 w-5" />
              </span>
              <span className="sidebar-label leading-tight">
                Dependency
                <br />
                Intelligence
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Explore</SidebarGroupLabel>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuButton key={item.href} active={active} tooltip={item.label} asChild>
                      <Link href={item.href} aria-label={item.label}>
                        <Icon className="h-4 w-4" />
                        <span className="sidebar-label">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
            {user?.role === "admin" ? (
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarMenu>
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.href);
                    return (
                      <SidebarMenuButton key={item.href} active={active} tooltip={item.label} asChild>
                        <Link href={item.href} aria-label={item.label}>
                          <Icon className="h-4 w-4" />
                          <span className="sidebar-label">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            ) : null}
          </SidebarContent>
          <SidebarFooter>
            <div className="sidebar-label rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              Enterprise dependency graph
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
              <SidebarTrigger />
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold lg:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-sky-400/40 bg-sky-400/10 text-sky-300">
                  <Share2 className="h-4 w-4" />
                </span>
                <span>Dependency Intelligence</span>
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  className="hidden h-9 w-9 p-0 md:inline-flex"
                  variant="ghost"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                {user ? (
                  <>
                    <span className="hidden h-9 items-center gap-2 rounded-md border border-border bg-muted/60 px-3 text-sm font-semibold md:flex">
                      {user.displayName}
                      <span className="rounded bg-background px-2 py-0.5 text-xs uppercase text-muted-foreground">{user.role}</span>
                    </span>
                    <Button variant="outline" size="sm" onClick={logout}>
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login">
                      <LogIn className="h-4 w-4" />
                      Login
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:hidden">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground",
                      active && "bg-blue-600/25 text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="px-4 py-5 lg:px-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
