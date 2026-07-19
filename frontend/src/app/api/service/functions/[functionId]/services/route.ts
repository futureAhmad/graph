import { NextRequest } from "next/server";
import { proxyToBackend } from "../../../../_proxy/proxy";

type RouteContext = {
  params: Promise<{ functionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { functionId } = await context.params;
  return proxyToBackend(request, `/service/functions/${encodeURIComponent(functionId)}/services`);
}
