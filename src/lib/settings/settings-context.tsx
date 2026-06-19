import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SETTINGS,
  type PanelGroupKey,
  type PanelLayout,
  type Settings,
  type SettingsStore,
} from "@/lib/settings/settings";

type SettingsContextValue = {
  settings: Settings;
  saveLayout: (group: PanelGroupKey, layout: PanelLayout) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsProviderProps = {
  store: SettingsStore;
  children: ReactNode;
};

export function SettingsProvider({ store, children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let isMounted = true;
    store.load().then((loaded) => {
      if (isMounted) {
        setSettings(loaded);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [store]);

  const saveLayout = useCallback(
    (group: PanelGroupKey, layout: PanelLayout) => {
      const base = settings ?? DEFAULT_SETTINGS;
      const next: Settings = {
        ...base,
        layouts: { ...base.layouts, [group]: layout },
      };
      setSettings(next);
      store.save(next);
    },
    [settings, store],
  );

  const value = useMemo<SettingsContextValue | null>(
    () => (settings === null ? null : { settings, saveLayout }),
    [settings, saveLayout],
  );

  if (value === null) {
    return null;
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return value;
}
