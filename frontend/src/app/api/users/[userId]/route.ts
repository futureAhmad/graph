import { NextRequest } from "next/server";
import { proxyToBackend } from "../../_proxy/proxy";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { userId } = await context.params;
  return proxyToBackend(request, `/users/${encodeURIComponent(userId)}`);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { userId } = await context.params;
  return proxyToBackend(request, `/users/${encodeURIComponent(userId)}`);
}
