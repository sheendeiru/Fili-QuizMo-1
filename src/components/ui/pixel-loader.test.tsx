import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PixelLoader } from "./pixel-loader";

describe("PixelLoader", () => {
  it("renders an accessible, pixelated full-screen loading state", () => {
    const markup = renderToStaticMarkup(
      createElement(PixelLoader, {
        label: "Loading dashboard",
        variant: "screen",
        delayMs: 0,
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Loading dashboard");
    expect(markup).toContain("pixel-loader-logo");
    expect(markup).toContain("Fili-QuizMo");
    expect(markup).toContain("min-h-screen");
  });
});
