import { NextRequest } from "next/server";
import { proxyToBackend } from "../../../_proxy/proxy";

type RouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { name } = await context.params;
  return proxyToBackend(request, `/impact/integ/${encodeURIComponent(name)}`);
}
