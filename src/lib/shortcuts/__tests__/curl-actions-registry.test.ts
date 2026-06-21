import { describe, it, expect } from "vitest";

import {
  SHORTCUT_ACTIONS,
  type ShortcutActionId,
} from "@/lib/shortcuts/registry";
import { resolveShortcuts } from "@/lib/shortcuts/resolve";

function findAction(id: ShortcutActionId) {
  return SHORTCUT_ACTIONS.find((action) => action.id === id);
}

describe("SHORTCUT_ACTIONS curl actions (AC-011)", () => {
  // AC-011 - behavior: copy-as-curl registered with Mod+Shift+C default.
  it("should register copy-as-curl with the Mod+Shift+C default", () => {
    const action = findAction("copy-as-curl");

    expect(action).toBeDefined();
    expect(action!.defaultHotkey).toBe("Mod+Shift+C");
  });

  // AC-011 - behavior: import-curl registered with Mod+Shift+I default.
  it("should register import-curl with the Mod+Shift+I default", () => {
    const action = findAction("import-curl");

    expect(action).toBeDefined();
    expect(action!.defaultHotkey).toBe("Mod+Shift+I");
  });

  // AC-011 - behavior: both curl actions carry a name and a description.
  it("should give each curl action a non-empty name and description", () => {
    const ids: ShortcutActionId[] = ["copy-as-curl", "import-curl"];

    ids.forEach((id) => {
      const action = findAction(id);
      expect(action).toBeDefined();
      expect(action!.name.length).toBeGreaterThan(0);
      expect(action!.description.length).toBeGreaterThan(0);
    });
  });

  // AC-011 - behavior: the resolved defaults expose both bindings with no overrides.
  it("should expose the curl actions' defaults from resolveShortcuts", () => {
    const effective = resolveShortcuts({});

    expect(effective["copy-as-curl"]).toBe("Mod+Shift+C");
    expect(effective["import-curl"]).toBe("Mod+Shift+I");
  });
});
