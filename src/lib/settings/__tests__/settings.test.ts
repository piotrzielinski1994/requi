import { describe, it, expect } from "vitest";

import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type Settings,
} from "@/lib/settings/settings";

describe("mergeSettings", () => {
  // AC-005 — behavior
  it("should pass a valid full settings object through unchanged", () => {
    const full: Settings = {
      version: 1,
      layouts: { workspace: { sidebar: 30, content: 70 } },
      consoleHidden: true,
    };

    expect(mergeSettings(DEFAULT_SETTINGS, full)).toEqual(full);
  });

  // AC-005, E-3 — behavior
  it("should fill missing keys from defaults if the partial omits them", () => {
    const partial = { consoleHidden: true };

    const merged = mergeSettings(DEFAULT_SETTINGS, partial);

    expect(merged.consoleHidden).toBe(true);
    expect(merged.version).toBe(DEFAULT_SETTINGS.version);
    expect(merged.layouts).toEqual(DEFAULT_SETTINGS.layouts);
  });

  // AC-005, E-3 — behavior
  it("should honor a nested layouts partial if only one group is present", () => {
    const partial = { layouts: { main: { content: 60, console: 40 } } };

    const merged = mergeSettings(DEFAULT_SETTINGS, partial);

    expect(merged.layouts.main).toEqual({ content: 60, console: 40 });
    expect(merged.consoleHidden).toBe(DEFAULT_SETTINGS.consoleHidden);
  });

  // AC-005, E-3 — behavior
  it("should drop unknown extra keys if the partial carries them", () => {
    const partial = { consoleHidden: true, bogus: "nope", extra: 42 };

    const merged = mergeSettings(DEFAULT_SETTINGS, partial);

    expect(merged).toEqual({
      version: 1,
      layouts: {},
      consoleHidden: true,
    });
    expect(merged).not.toHaveProperty("bogus");
    expect(merged).not.toHaveProperty("extra");
  });

  // AC-005, E-2 — behavior
  it("should return defaults if the partial is null", () => {
    expect(mergeSettings(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS);
  });

  // AC-005, E-2 — behavior
  it("should return defaults if the partial is undefined", () => {
    expect(mergeSettings(DEFAULT_SETTINGS, undefined)).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  // AC-005, E-2 — behavior
  it("should return defaults if the partial is a string", () => {
    expect(mergeSettings(DEFAULT_SETTINGS, "garbage")).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  // AC-005, E-2 — behavior
  it("should return defaults if the partial is a number", () => {
    expect(mergeSettings(DEFAULT_SETTINGS, 123)).toEqual(DEFAULT_SETTINGS);
  });

  // AC-005, E-2 — behavior
  it("should not throw if the partial is garbage", () => {
    expect(() => mergeSettings(DEFAULT_SETTINGS, [])).not.toThrow();
    expect(() => mergeSettings(DEFAULT_SETTINGS, true)).not.toThrow();
    expect(() => mergeSettings(DEFAULT_SETTINGS, null)).not.toThrow();
  });
});
