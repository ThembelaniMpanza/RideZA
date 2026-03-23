// app/_layout.jsx
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../src/theme/ThemeProvider";

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState(null);

  // 🔹 Remove this line for production
  useEffect(() => {
    const checkOnboarding = async () => {
      // Optional dev-only reset:
      // Set `EXPO_PUBLIC_RESET_ONBOARDING=1` to reset flags on next launch.
      if (__DEV__ && process.env.EXPO_PUBLIC_RESET_ONBOARDING === "1") {
        await AsyncStorage.removeItem("hasOnboarded");
        await AsyncStorage.removeItem("@user_token");
      }

      const [hasOnboarded, userToken] = await Promise.all([
        AsyncStorage.getItem("hasOnboarded"),
        AsyncStorage.getItem("@user_token"),
      ]);

      // Routing rules:
      // 1) Logged in -> main app
      // 2) Onboarding done but not logged in -> auth
      // 3) Otherwise -> onboarding
      if (userToken) {
        setInitialRoute("(main)");
      } else if (hasOnboarded) {
        setInitialRoute("(auth)");
      } else {
        setInitialRoute("(onboarding)");
      }
    };
    checkOnboarding();
  }, []);

  if (!initialRoute) return null; // wait for AsyncStorage to load

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#00000000" },
          animation: "fade",
        }}
        initialRouteName={initialRoute}
      />
    </ThemeProvider>
  );
}
