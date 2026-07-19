import { NextRequest } from "next/server";
import { proxyToBackend } from "../../_proxy/proxy";

export function GET(request: NextRequest) {
  return proxyToBackend(request, "/service/applications");
}
