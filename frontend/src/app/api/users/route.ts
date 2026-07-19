import { NextRequest } from "next/server";
import { proxyToBackend } from "../_proxy/proxy";

export function GET(request: NextRequest) {
  return proxyToBackend(request, "/users");
}

export function POST(request: NextRequest) {
  return proxyToBackend(request, "/users");
}
