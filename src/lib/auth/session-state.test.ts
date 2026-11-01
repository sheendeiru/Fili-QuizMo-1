import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSessionRequestController,
  resetSessionState,
  SESSION_ENDED_STORAGE_KEY,
  SESSION_EPOCH_STORAGE_KEY,
  sessionLoginPath,
} from "./session-state";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("session cleanup", () => {
  it("clears browser storage, aborts active requests, and redirects protected pages", async () => {
    const localStorage = {
      clear: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const sessionStorage = {
      clear: vi.fn(),
      getItem: vi.fn(() => "4"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const replace = vi.fn();

    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      localStorage,
      sessionStorage,
      location: {
        pathname: "/teacher-dashboard",
        origin: "http://localhost:3000",
        replace,
      },
      setTimeout: vi.fn(),
    });
    vi.stubGlobal("document", {
      querySelectorAll: vi.fn(() => []),
    });

    const request = createSessionRequestController();
    await resetSessionState();

    expect(localStorage.clear).toHaveBeenCalledOnce();
    expect(sessionStorage.clear).toHaveBeenCalledOnce();
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      SESSION_ENDED_STORAGE_KEY,
      expect.any(String),
    );
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      SESSION_EPOCH_STORAGE_KEY,
      "5",
    );
    expect(request.signal.aborted).toBe(true);
    expect(replace).toHaveBeenCalledWith(
      "/teacher-login?status=session_expired",
    );
  });

  it.each([
    ["/admin-dashboard", "/admin-login?status=session_expired"],
    ["/teacher-dashboard", "/teacher-login?status=session_expired"],
    ["/student-dashboard", "/student-login?status=session_expired"],
    ["/complete-profile", "/signup?status=session_expired"],
    ["/teacher-login", undefined],
  ])("maps %s to its session-expired destination", (pathname, expected) => {
    expect(sessionLoginPath(pathname)).toBe(expected);
  });
});
