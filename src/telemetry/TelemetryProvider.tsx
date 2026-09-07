import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  flushTelemetry,
  getTelemetryConfiguration,
  recordAppStart,
  setAnalyticsConsent as applyAnalyticsConsent,
  trackScreen,
} from "./telemetry";

const ANALYTICS_CONSENT_KEY = "@rideza_analytics_consent_v1";
const TELEMETRY_CONFIGURATION = getTelemetryConfiguration();

type TelemetryContextValue = {
  analyticsConfigured: boolean;
  analyticsConsent: boolean;
  crashReportingConfigured: boolean;
  environment: string;
  isReady: boolean;
  setAnalyticsConsent(granted: boolean): Promise<void>;
};

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [analyticsConsent, setConsentState] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ANALYTICS_CONSENT_KEY)
      .then(value => {
        const granted = value === "granted";
        if (!active) return;
        setConsentState(granted);
        return applyAnalyticsConsent(granted);
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
          recordAppStart();
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isReady) trackScreen(pathname);
  }, [isReady, pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") void flushTelemetry();
    });
    return () => subscription.remove();
  }, []);

  const setAnalyticsConsent = useCallback(async (granted: boolean) => {
    await AsyncStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      granted ? "granted" : "denied",
    );
    await applyAnalyticsConsent(granted);
    setConsentState(granted);
  }, []);

  const value = useMemo<TelemetryContextValue>(() => ({
    analyticsConfigured: TELEMETRY_CONFIGURATION.analyticsConfigured,
    analyticsConsent,
    crashReportingConfigured: TELEMETRY_CONFIGURATION.crashReportingConfigured,
    environment: TELEMETRY_CONFIGURATION.environment,
    isReady,
    setAnalyticsConsent,
  }), [analyticsConsent, isReady, setAnalyticsConsent]);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const value = useContext(TelemetryContext);
  if (!value) throw new Error("useTelemetry must be used within TelemetryProvider");
  return value;
}
