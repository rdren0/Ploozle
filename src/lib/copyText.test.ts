import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copyText";

const URL = "https://www.youtube.com/watch?v=abc";

function stubDocument(execCommand: () => boolean) {
  const field = { value: "", style: {}, select: vi.fn(), remove: vi.fn() };
  const fake = {
    activeElement: null,
    body: { appendChild: vi.fn() },
    createElement: () => field,
    execCommand: vi.fn(execCommand),
  };
  vi.stubGlobal("document", fake);
  return { fake, field };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("uses the clipboard API when it is allowed", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { fake } = stubDocument(() => true);

    expect(await copyText(URL)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(fake.execCommand).not.toHaveBeenCalled();
  });

  // What an embedding page that doesn't delegate the permission looks like.
  it("falls back to a selection when the API refuses", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { fake, field } = stubDocument(() => true);

    expect(await copyText(URL)).toBe(true);
    expect(field.value).toBe(URL);
    expect(fake.execCommand).toHaveBeenCalledWith("copy");
    expect(field.remove).toHaveBeenCalled();
  });

  it("falls back when the API is missing altogether", async () => {
    vi.stubGlobal("navigator", {});
    stubDocument(() => true);

    expect(await copyText(URL)).toBe(true);
  });

  it("reports failure rather than claiming a copy that didn't happen", async () => {
    vi.stubGlobal("navigator", {});
    const { field } = stubDocument(() => false);

    expect(await copyText(URL)).toBe(false);
    expect(field.remove).toHaveBeenCalled();
  });
});
