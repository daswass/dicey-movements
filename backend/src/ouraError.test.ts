import { AxiosError, AxiosHeaders } from "axios";
import { classifyOuraError, logOuraError, toSafeOuraError } from "./ouraError";

const secrets = {
  refreshToken: "refresh-token-should-never-appear",
  clientId: "oura-client-id-should-never-appear",
  clientSecret: "oura-client-secret-should-never-appear",
};

function oauthAxiosError(status: number): AxiosError {
  return new AxiosError("OAuth request failed", "ERR_BAD_REQUEST", {
    headers: new AxiosHeaders({
      Authorization: `Bearer ${secrets.refreshToken}`,
      "x-client-id": secrets.clientId,
      "x-client-secret": secrets.clientSecret,
    }),
    data: new URLSearchParams({
      refresh_token: secrets.refreshToken,
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
    }).toString(),
    method: "post",
    url: "https://api.ouraring.com/oauth/token",
  }, undefined, {
    status,
    statusText: "Unauthorized",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { detail: secrets.refreshToken },
  });
}

describe("Oura error sanitization", () => {
  it.each([
    [401, "authorization_failed"],
    [429, "rate_limited"],
    [503, "upstream_unavailable"],
  ])("classifies Oura HTTP %i as %s", (status, expected) => {
    expect(classifyOuraError(oauthAxiosError(status))).toBe(expected);
  });

  it("never includes OAuth credentials in thrown or logged errors", () => {
    const error = oauthAxiosError(401);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const safeError = toSafeOuraError(error);
    logOuraError("Scheduled Oura sync failed for user user-123", error);

    const output = `${safeError.message} ${consoleError.mock.calls.flat().join(" ")}`;
    expect(output).toContain("authorization_failed");
    expect(output).toContain("user-123");
    expect(output).not.toContain(secrets.refreshToken);
    expect(output).not.toContain(secrets.clientId);
    expect(output).not.toContain(secrets.clientSecret);
  });
});
