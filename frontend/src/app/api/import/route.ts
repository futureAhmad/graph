import { NextRequest } from "next/server";
import { proxyToBackend } from "../_proxy/proxy";

export function POST(request: NextRequest) {
  return proxyToBackend(request, "/import");
}

export function DELETE(request: NextRequest) {
  return proxyToBackend(request, "/import");
}
