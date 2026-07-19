import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export async function proxyToBackend(request: NextRequest, path: string): Promise<NextResponse> {
  const targetUrl = new URL(stripLeadingSlash(path), normalizedBackendUrl());
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers();
  copyHeader(request.headers, headers, "content-type");
  copyHeader(request.headers, headers, "accept");
  copyHeader(request.headers, headers, "cookie");

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store"
  });

  const responseHeaders = new Headers();
  copyHeader(backendResponse.headers, responseHeaders, "content-type");
  copyHeader(backendResponse.headers, responseHeaders, "set-cookie");

  return new NextResponse(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders
  });
}

function normalizedBackendUrl(): string {
  return BACKEND_URL.endsWith("/") ? BACKEND_URL : `${BACKEND_URL}/`;
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

function copyHeader(source: Headers, target: Headers, name: string): void {
  const value = source.get(name);
  if (value) {
    target.set(name, value);
  }
}
