import { Stack } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth/AuthProvider";
import { CrashBoundary } from "../src/components/CrashBoundary";
import { ThemeProvider } from "../src/theme/ThemeProvider";

function RootNavigator() {
  const { user, isReady, hasOnboarded } = useAuth();

  if (!isReady) {
    return (
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
          Restoring your session
        </Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#00000000" },
        animation: "fade",
      }}
    >
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(main)" />
      </Stack.Protected>
      <Stack.Protected guard={!user && hasOnboarded}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!user && !hasOnboarded}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <CrashBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </CrashBoundary>
  );
}
