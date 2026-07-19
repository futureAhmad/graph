"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  Cloud,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  Fingerprint,
  GitBranch,
  Globe2,
  Headphones,
  Landmark,
  Lock,
  Network,
  Server,
  ShieldCheck,
  User,
  WalletCards
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/layout/auth-provider";
import { requestAccess } from "@/features/auth/auth.api";

type GraphNode = {
  id: string;
  label: string;
  icon: typeof Landmark;
  x: number;
  y: number;
  tone?: "teal" | "amber";
};

type GraphColumn = {
  label: string;
  nodes: GraphNode[];
};

const graphColumns: GraphColumn[] = [
  {
    label: "Business functions",
    nodes: [
      { id: "retail", label: "Retail Banking", icon: Landmark, x: 54, y: 122 },
      { id: "corporate", label: "Corporate Banking", icon: Building2, x: 54, y: 208 },
      { id: "cards", label: "Card Services", icon: CreditCard, x: 54, y: 318 },
      { id: "support", label: "Contact Center", icon: Headphones, x: 54, y: 404 }
    ]
  },
  {
    label: "Services",
    nodes: [
      { id: "payments", label: "Payment Services", icon: WalletCards, x: 286, y: 188 },
      { id: "customer", label: "Customer 360", icon: User, x: 286, y: 350 }
    ]
  },
  {
    label: "Channels",
    nodes: [
      { id: "mobile", label: "Mobile Banking", icon: CreditCard, x: 512, y: 126 },
      { id: "web", label: "Online Banking", icon: Globe2, x: 512, y: 256 },
      { id: "branch", label: "Branch Channel", icon: Landmark, x: 512, y: 386 },
      { id: "call", label: "Call Center", icon: Headphones, x: 512, y: 492 }
    ]
  },
  {
    label: "Applications",
    nodes: [
      { id: "api", label: "Open Banking API", icon: GitBranch, x: 748, y: 174 },
      { id: "identity", label: "Digital Identity", icon: Fingerprint, x: 748, y: 306 },
      { id: "core", label: "Core Banking", icon: Landmark, x: 748, y: 426 },
      { id: "crm", label: "CRM", icon: User, x: 748, y: 536 }
    ]
  },
  {
    label: "Partners / infrastructure",
    nodes: [
      { id: "engine", label: "Payment Switch", icon: Network, x: 968, y: 88, tone: "teal" },
      { id: "fraud", label: "Fraud Monitoring", icon: ShieldCheck, x: 968, y: 158, tone: "teal" },
      { id: "oracle", label: "Oracle Database", icon: Database, x: 968, y: 238, tone: "teal" },
      { id: "linux", label: "Linux Cluster", icon: Server, x: 968, y: 316, tone: "teal" },
      { id: "cloud", label: "Cloud Platform", icon: Cloud, x: 968, y: 394, tone: "teal" },
      { id: "partner", label: "Regulatory Link", icon: Building2, x: 968, y: 474, tone: "amber" },
      { id: "vendor", label: "Banking Partner", icon: Building2, x: 968, y: 552, tone: "amber" }
    ]
  }
];

const graphLinks = [
  ["retail", "payments"],
  ["corporate", "payments"],
  ["cards", "customer"],
  ["support", "customer"],
  ["payments", "mobile"],
  ["payments", "web"],
  ["payments", "branch"],
  ["customer", "web"],
  ["customer", "branch"],
  ["customer", "call"],
  ["mobile", "api"],
  ["web", "api"],
  ["web", "identity"],
  ["web", "core"],
  ["branch", "identity"],
  ["branch", "core"],
  ["call", "crm"],
  ["api", "engine"],
  ["api", "fraud"],
  ["api", "oracle"],
  ["identity", "linux"],
  ["identity", "cloud"],
  ["core", "oracle"],
  ["core", "partner"],
  ["core", "vendor"],
  ["crm", "cloud"],
  ["crm", "vendor"]
];

const graphNodes = graphColumns.flatMap((column) => column.nodes);
const nodeById = new Map(graphNodes.map((node) => [node.id, node]));

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await login(username, password);
      if ("message" in result) {
        setMessage(result.message);
        setPassword("");
        return;
      }
      router.push(result.role === "admin" ? "/admin/users" : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAccessRequest() {
    setLoading(false);
    setRequestingAccess(true);
    setError(null);
    setMessage(null);
    try {
      const result = await requestAccess(username, password);
      setMessage(result.message);
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request access.");
    } finally {
      setRequestingAccess(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#020817] dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(360px,0.42fr)_1fr]">
        <section className="relative flex min-h-screen items-center border-r border-blue-200 bg-white px-5 py-8 text-slate-950 sm:px-8 lg:px-10 dark:border-sky-300/10 dark:bg-[#061126] dark:text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_4%,rgba(37,99,235,0.12),transparent_22rem),radial-gradient(circle_at_92%_90%,rgba(14,165,233,0.08),transparent_24rem)] dark:bg-[radial-gradient(circle_at_12%_4%,rgba(0,102,255,0.2),transparent_22rem),radial-gradient(circle_at_92%_90%,rgba(14,165,233,0.12),transparent_24rem)]" />
          <div className="relative mx-auto w-full max-w-[27rem]">
            <div className="mb-12 flex items-center gap-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-blue-300 bg-blue-50 dark:border-sky-300/30 dark:bg-sky-400/10">
                <span className="absolute h-5 w-5 rotate-45 rounded-sm border-2 border-blue-500 dark:border-sky-300" />
                <span className="absolute h-2.5 w-2.5 rotate-45 rounded-[2px] bg-blue-500" />
              </span>
              <span className="text-lg font-semibold tracking-[0.22em] text-blue-950 dark:text-sky-50">ALINMA DEPENDENCY</span>
            </div>

            <div className="mb-7">
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl dark:text-white">Sign in</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
               Authenticate with your LDAP account
              </p>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <label className="block space-y-2 text-sm font-semibold">
                <span>Username</span>
                <span className="relative block">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-500" />
                  <Input
                    className="h-11 rounded-md border-blue-200 bg-white pl-10 text-sm text-slate-950 shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500 dark:border-sky-300/15 dark:bg-white/[0.055] dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-sky-400"
                    value={username}
                    onChange={(event) => setUsername(event.target.value.replace(/[^A-Za-z]/g, ""))}
                    pattern="[A-Za-z]+"
                    inputMode="text"
                    autoComplete="username"
                    placeholder="Username"
                    required
                  />
                </span>
              </label>
              <label className="block space-y-2 text-sm font-semibold">
                <span>Password</span>
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-500" />
                  <Input
                    className="h-11 rounded-md border-blue-200 bg-white px-10 text-sm text-slate-950 shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500 dark:border-sky-300/15 dark:bg-white/[0.055] dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-sky-400"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-blue-700 dark:hover:text-sky-300"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </span>
              </label>
              {message ? (
                <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{error}</p>
              ) : null}
              <Button
                className="h-11 w-full rounded-md bg-blue-700 text-sm text-white shadow-[0_16px_34px_rgba(37,99,235,0.22)] hover:bg-blue-600 dark:bg-blue-600 dark:shadow-[0_16px_34px_rgba(37,99,235,0.24)] dark:hover:bg-blue-500"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in" : "Sign In"}
              </Button>
            </form>

            <div className="mt-8 border-t border-blue-100 pt-6 text-center dark:border-sky-300/10">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-300 dark:hover:text-sky-200"
                onClick={submitAccessRequest}
                disabled={requestingAccess || !username || password.length < 6}
                title={!username || password.length < 6 ? "Enter a letters-only username and password first" : "Request account approval"}
              >
                {requestingAccess ? "Sending request" : "Request Access"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="relative hidden min-h-screen overflow-hidden bg-slate-50 px-8 py-10 lg:block dark:bg-[#03102a]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_18%,rgba(37,99,235,0.16),transparent_22rem),radial-gradient(circle_at_84%_70%,rgba(14,165,233,0.1),transparent_20rem)] dark:bg-[radial-gradient(circle_at_42%_18%,rgba(0,102,255,0.28),transparent_22rem),radial-gradient(circle_at_84%_70%,rgba(14,165,233,0.14),transparent_20rem)]" />
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(37,99,235,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.14)_1px,transparent_1px)] [background-size:36px_36px] dark:opacity-[0.16] dark:[background-image:linear-gradient(rgba(96,165,250,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.13)_1px,transparent_1px)]" />
          <div className="relative mx-auto flex h-full max-w-[62rem] flex-col">
            <div className="pt-4 text-center">
              <h2 className="text-3xl font-semibold tracking-normal text-blue-950 xl:text-4xl dark:text-sky-50">Banking services dependency view</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                A focused map of functions, digital channels, core systems, partners, and infrastructure exposure.
              </p>
            </div>
            <DependencyGraph />
          </div>
        </section>
      </div>
    </main>
  );
}

function DependencyGraph() {
  return (
    <div className="relative mx-auto mt-8 min-h-[32rem] w-full max-w-[58rem] flex-1">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1150 650" aria-hidden="true">
        <defs>
          <linearGradient id="loginLink" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.62" />
            <stop offset="55%" stopColor="#2563eb" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.78" />
          </linearGradient>
          <filter id="loginGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {graphColumns.map((column, index) => {
          const x = column.nodes[0]?.x ?? 0;
          return (
            <g key={column.label}>
              <text x={x + 70} y="42" textAnchor="middle" className="fill-blue-900 text-[11px] font-semibold uppercase tracking-[0.14em] dark:fill-sky-100">
                {column.label}
              </text>
              <line x1={x + 70} y1="60" x2={x + 70} y2="604" stroke="rgba(96,165,250,0.14)" strokeDasharray="2 5" />
              <circle cx={x + 70} cy="60" r="3" fill="#60a5fa" filter="url(#loginGlow)" />
              {index < graphColumns.length - 1 ? (
                <line x1={x + 88} y1="60" x2={(graphColumns[index + 1].nodes[0]?.x ?? x) + 52} y2="60" stroke="rgba(96,165,250,0.11)" />
              ) : null}
            </g>
          );
        })}
        {graphLinks.map(([sourceId, targetId]) => {
          const source = nodeById.get(sourceId);
          const target = nodeById.get(targetId);
          if (!source || !target) {
            return null;
          }
          const startX = source.x + 142;
          const startY = source.y + 23;
          const endX = target.x;
          const endY = target.y + 23;
          const controlOffset = Math.max(70, (endX - startX) * 0.46);
          return (
            <path
              key={`${sourceId}-${targetId}`}
              d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`}
              fill="none"
              stroke="url(#loginLink)"
              strokeWidth="1.6"
              strokeLinecap="round"
              filter="url(#loginGlow)"
            />
          );
        })}
        {graphLinks.map(([sourceId, targetId]) => {
          const source = nodeById.get(sourceId);
          const target = nodeById.get(targetId);
          if (!source || !target) {
            return null;
          }
          return (
            <g key={`${sourceId}-${targetId}-points`}>
              <circle cx={source.x + 142} cy={source.y + 23} r="2.8" fill="#bfdbfe" filter="url(#loginGlow)" />
              <circle cx={target.x} cy={target.y + 23} r="2.8" fill="#38bdf8" filter="url(#loginGlow)" />
            </g>
          );
        })}
      </svg>

      {graphColumns.flatMap((column) =>
        column.nodes.map((node) => {
          const Icon = node.icon;
          const isAmber = node.tone === "amber";
          const isTeal = node.tone === "teal";
          return (
            <div
              key={node.id}
              className={`absolute flex h-11 w-36 items-center gap-2 rounded-md border px-2.5 text-[12px] font-semibold shadow-[0_14px_32px_rgba(15,23,42,0.12)] backdrop-blur dark:shadow-[0_14px_32px_rgba(0,0,0,0.2)] ${
                isAmber
                  ? "border-blue-300 bg-blue-50/90 text-blue-900 dark:border-blue-300/55 dark:bg-blue-500/10 dark:text-blue-50"
                  : isTeal
                    ? "border-sky-300 bg-sky-50/90 text-sky-950 dark:border-sky-300/60 dark:bg-sky-400/10 dark:text-sky-50"
                    : "border-blue-200 bg-white/90 text-slate-900 dark:border-blue-300/35 dark:bg-blue-500/10 dark:text-white"
              }`}
              style={{ left: `${(node.x / 1150) * 100}%`, top: `${(node.y / 650) * 100}%` }}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                  isAmber
                    ? "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-200/50 dark:bg-blue-300/10 dark:text-blue-200"
                    : "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-200/45 dark:bg-sky-300/10 dark:text-sky-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="leading-tight">{node.label}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
