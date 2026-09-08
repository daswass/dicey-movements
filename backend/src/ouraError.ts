import axios from "axios";

export type OuraErrorClassification =
  | "authorization_failed"
  | "invalid_request"
  | "rate_limited"
  | "upstream_unavailable"
  | "network_error"
  | "not_connected"
  | "unexpected_error";

/**
 * Classify Oura failures without serializing Axios errors. Axios error objects can
 * contain request bodies and headers, including OAuth credentials and tokens.
 */
export function classifyOuraError(error: unknown): OuraErrorClassification {
  if (axios.isAxiosError(error)) {
    switch (error.response?.status) {
      case 400:
      case 404:
        return "invalid_request";
      case 401:
      case 403:
        return "authorization_failed";
      case 429:
        return "rate_limited";
      default:
        return error.response?.status && error.response.status >= 500
          ? "upstream_unavailable"
          : "network_error";
    }
  }

  if (error instanceof Error && error.message === "No Oura tokens found for user") {
    return "not_connected";
  }

  return "unexpected_error";
}

export function toSafeOuraError(error: unknown): Error {
  return new Error(`Oura request failed (${classifyOuraError(error)})`);
}

export function logOuraError(context: string, error: unknown): void {
  console.error(`${context} [${classifyOuraError(error)}]`);
}
