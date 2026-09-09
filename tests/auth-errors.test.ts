import { describe, expect, it, vi } from "vitest";
import { loginErrorMessage } from "@/lib/security/auth-errors";

const err = (code: string | undefined, status = 400, message = "") => ({ code, status, message });

describe("loginErrorMessage", () => {
  it("keeps a neutral message for wrong credentials", () => {
    expect(loginErrorMessage(err("invalid_credentials"))).toBe("E-mail ou mot de passe incorrect.");
  });

  it("tells the user when the address is not confirmed", () => {
    const message = loginErrorMessage(err("email_not_confirmed"));
    expect(message).toMatch(/confirm/i);
    expect(message).not.toMatch(/incorrect/i);
  });

  it("does not present a configuration failure as a wrong password", () => {
    const onServerFault = vi.fn();
    // Clé anon invalide / projet Supabase injoignable / schéma auth cassé.
    for (const error of [err(undefined, 401, "Invalid API key"), err("unexpected_failure", 500), err(undefined, 0, "Failed to fetch")]) {
      const message = loginErrorMessage(error, onServerFault);
      expect(message).not.toMatch(/mot de passe incorrect/i);
      expect(message).toMatch(/authentification/i);
    }
    expect(onServerFault).toHaveBeenCalledTimes(3);
  });

  it("surfaces rate limiting and banned accounts", () => {
    expect(loginErrorMessage(err("over_request_rate_limit", 429))).toMatch(/tentatives/i);
    expect(loginErrorMessage(err(undefined, 429))).toMatch(/tentatives/i);
    expect(loginErrorMessage(err("user_banned"))).toMatch(/suspendu/i);
  });

  it("never reports a server fault for the two expected user errors", () => {
    const onServerFault = vi.fn();
    loginErrorMessage(err("invalid_credentials"), onServerFault);
    loginErrorMessage(err("email_not_confirmed"), onServerFault);
    expect(onServerFault).not.toHaveBeenCalled();
  });
});
