import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getColors, ThemeColors, ThemeMode } from "./theme";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "@theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
    };
    load();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark =
    mode === "dark" ? true : mode === "light" ? false : systemScheme === "dark";

  const colors = useMemo(() => getColors(isDark), [isDark]);

  const value = useMemo(
    () => ({ mode, setMode, isDark, colors }),
    [mode, setMode, isDark, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

