import { NextRequest } from "next/server";
import { proxyToBackend } from "../../_proxy/proxy";

export function POST(request: NextRequest) {
  return proxyToBackend(request, "/auth/login");
}
