import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function MainLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.cardSolid,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="ride"
        options={{
          title: "Ride",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="directions-car" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="previous-rides"
        options={{
          title: "Previous",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={size} color={color} />
          ),
        }}
      />

      {/* Not a tab: pushed from the Ride flow */}
      <Tabs.Screen name="ride-options" options={{ href: null }} />

      {/* Keep index hidden; it just redirects to the default tab. */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
