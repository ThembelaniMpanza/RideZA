import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { CrashBoundary } from "../src/components/CrashBoundary";
import { ThemeProvider } from "../src/theme/ThemeProvider";

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const checkOnboarding = async () => {
      try {
        // Set `EXPO_PUBLIC_RESET_ONBOARDING=1` in dev to reset flags on next launch.
        if (__DEV__ && process.env.EXPO_PUBLIC_RESET_ONBOARDING === "1") {
          await AsyncStorage.removeItem("hasOnboarded");
          await AsyncStorage.removeItem("@user_token");
        }

        const [hasOnboarded, userToken] = await Promise.all([
          AsyncStorage.getItem("hasOnboarded"),
          AsyncStorage.getItem("@user_token"),
        ]);

        if (!isMounted) return;

        if (userToken) {
          setInitialRoute("(main)");
        } else if (hasOnboarded) {
          setInitialRoute("(auth)");
        } else {
          setInitialRoute("(onboarding)");
        }
      } catch (error) {
        console.error("[RideZA boot route]", error);
        if (isMounted) setInitialRoute("(auth)");
      }
    };

    void checkOnboarding();

    const fallback = setTimeout(() => {
      if (isMounted) setInitialRoute(route => route ?? "(auth)");
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(fallback);
    };
  }, []);

  return (
    <CrashBoundary>
      <ThemeProvider>
        {!initialRoute ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0B0D12",
              paddingHorizontal: 24,
            }}
          >
            <ActivityIndicator color="#2563EB" />
            <Text
              style={{
                marginTop: 12,
                color: "#AAB0C0",
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              Starting RideZA
            </Text>
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#00000000" },
              animation: "fade",
            }}
            initialRouteName={initialRoute}
          />
        )}
      </ThemeProvider>
    </CrashBoundary>
  );
}
