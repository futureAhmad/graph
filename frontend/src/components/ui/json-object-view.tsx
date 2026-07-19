"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export function JsonObjectView({ value }: { value: Record<string, JsonValue> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="relative max-h-72 w-full overflow-auto rounded-md p-3 font-mono text-xs leading-6 shadow-inner"
      style={{
        backgroundColor: "#050b16",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#cbd5e1"
      }}
    >
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 rounded-md p-1.5 transition hover:bg-white/10 hover:text-white"
        style={{ color: copied ? "#34d399" : "#94a3b8" }}
        title="Copy JSON"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="whitespace-pre-wrap pr-8">
        <JsonSyntax value={value} depth={0} />
      </pre>
    </div>
  );
}

function JsonSyntax({ value, depth }: { value: JsonValue; depth: number }) {
  if (Array.isArray(value)) {
    return (
      <>
        <span style={{ color: "#64748b" }}>[</span>
        {value.map((item, index) => (
          <span key={index}>
            {"\n"}
            {indent(depth + 1)}
            <JsonSyntax value={item} depth={depth + 1} />
            {index < value.length - 1 ? <span style={{ color: "#94a3b8" }}>,</span> : null}
          </span>
        ))}
        {value.length > 0 ? `\n${indent(depth)}` : null}
        <span style={{ color: "#64748b" }}>]</span>
      </>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    return (
      <>
        <span style={{ color: "#64748b" }}>{"{"}</span>
        {entries.map(([key, item], index) => (
          <span key={key}>
            {"\n"}
            {indent(depth + 1)}
            <span style={{ color: "#7dd3fc" }}>"{key}"</span>
            <span style={{ color: "#94a3b8" }}>: </span>
            <JsonSyntax value={item} depth={depth + 1} />
            {index < entries.length - 1 ? <span style={{ color: "#94a3b8" }}>,</span> : null}
          </span>
        ))}
        {entries.length > 0 ? `\n${indent(depth)}` : null}
        <span style={{ color: "#64748b" }}>{"}"}</span>
      </>
    );
  }

  if (typeof value === "string") {
    return <span style={{ color: "#6ee7b7" }}>"{value}"</span>;
  }

  if (typeof value === "number") {
    return <span style={{ color: "#fdba74" }}>{value}</span>;
  }

  if (typeof value === "boolean") {
    return <span style={{ color: "#d8b4fe" }}>{String(value)}</span>;
  }

  return <span style={{ color: "#94a3b8" }}>null</span>;
}

function indent(depth: number) {
  return "  ".repeat(depth);
}
