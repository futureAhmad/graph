const API_BASE_URL = "/api";

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(parseErrorMessage(message) || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function parseErrorMessage(message: string): string {
  if (!message) {
    return "";
  }
  try {
    const parsed = JSON.parse(message) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }
    return parsed.message ?? message;
  } catch {
    return message;
  }
}
