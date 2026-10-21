import type { ApiErrorBody, ApiErrorCode } from "@/shared/market";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "NETWORK",
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A response body plus when this client received it, by the client's own clock. */
export type Received<T> = T & { receivedAt: number };

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorBody).error?.code === "string"
  );
}

export async function fetchFromApi<T>(path: string, signal?: AbortSignal): Promise<Received<T>> {
  let response: Response;
  try {
    response = await fetch(path, { signal, headers: { accept: "application/json" } });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError(0, "NETWORK", "Could not reach the server.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiErrorBody(body)) {
      const { code, message, retryAfterSeconds } = body.error;
      throw new ApiError(response.status, code, message, retryAfterSeconds);
    }
    throw new ApiError(response.status, "INTERNAL", `Request failed with HTTP ${response.status}.`);
  }
  if (body === null) throw new ApiError(response.status, "INTERNAL", "Invalid server response.");
  return { ...(body as T), receivedAt: Date.now() };
}
