export type PanelLayout = Record<string, number>;

export type PanelGroupKey = "workspace" | "main" | "content";

export type Settings = {
  version: 1;
  layouts: Partial<Record<PanelGroupKey, PanelLayout>>;
  consoleHidden: boolean;
};

export type SettingsStore = {
  load: () => Promise<Settings>;
  save: (settings: Settings) => Promise<void>;
};

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  layouts: {},
  consoleHidden: false,
};

const GROUP_KEYS: PanelGroupKey[] = ["workspace", "main", "content"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPanelLayout(value: unknown): value is PanelLayout {
  return (
    isRecord(value) &&
    Object.values(value).every((size) => typeof size === "number")
  );
}

function mergeLayouts(partial: unknown): Settings["layouts"] {
  if (!isRecord(partial)) {
    return DEFAULT_SETTINGS.layouts;
  }
  return GROUP_KEYS.reduce<Settings["layouts"]>((acc, key) => {
    const layout = partial[key];
    return isPanelLayout(layout) ? { ...acc, [key]: layout } : acc;
  }, {});
}

export function mergeSettings(defaults: Settings, partial: unknown): Settings {
  if (!isRecord(partial)) {
    return defaults;
  }
  return {
    version: defaults.version,
    layouts: mergeLayouts(partial.layouts),
    consoleHidden:
      typeof partial.consoleHidden === "boolean"
        ? partial.consoleHidden
        : defaults.consoleHidden,
  };
}
