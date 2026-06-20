import { useHotkeys, type UseHotkeyDefinition } from "@tanstack/react-hotkeys";
import type { Hotkey } from "@tanstack/hotkeys";
import { useSettings } from "@/lib/settings/settings-context";
import { resolveShortcuts } from "@/lib/shortcuts/resolve";
import type { ShortcutActionId } from "@/lib/shortcuts/registry";

export function useActionHotkeys(
  handlers: Partial<Record<ShortcutActionId, () => void>>,
): void {
  const { settings } = useSettings();
  const effective = resolveShortcuts(settings.shortcuts);

  const definitions: UseHotkeyDefinition[] = (
    Object.keys(handlers) as ShortcutActionId[]
  ).map((id) => ({
    hotkey: effective[id] as Hotkey,
    callback: () => {
      handlers[id]?.();
    },
  }));

  // No global ignoreInputs: let the library pick per-hotkey. Mod/Ctrl combos
  // and Escape fire even with focus in an input or the config editor; bare keys
  // stay suppressed while typing.
  useHotkeys(definitions);
}
