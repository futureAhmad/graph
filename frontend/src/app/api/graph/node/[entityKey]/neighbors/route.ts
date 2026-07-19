import { NextRequest } from "next/server";
import { proxyToBackend } from "../../../../_proxy/proxy";

type RouteContext = {
  params: Promise<{ entityKey: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { entityKey } = await context.params;
  return proxyToBackend(request, `/graph/node/${encodeURIComponent(entityKey)}/neighbors`);
}
