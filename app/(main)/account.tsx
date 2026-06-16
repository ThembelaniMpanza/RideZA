import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import type { ThemeColors, ThemeMode } from "../../src/theme/theme";

type ThemeOption = {
  mode: ThemeMode;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
};

type MenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  subtitle: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  { mode: "system", icon: "desktop-windows", label: "System" },
  { mode: "light", icon: "light-mode", label: "Light" },
  { mode: "dark", icon: "dark-mode", label: "Dark" },
];

const MENU_ITEMS: MenuItem[] = [
  {
    icon: "credit-card",
    label: "Payment Methods",
    subtitle: "Add or manage cards",
  },
  {
    icon: "notifications-none",
    label: "Notifications",
    subtitle: "Push and email preferences",
  },
  {
    icon: "shield",
    label: "Safety",
    subtitle: "Emergency contacts and settings",
  },
  {
    icon: "help-outline",
    label: "Help & Support",
    subtitle: "FAQ, contact us",
  },
];

export default function AccountTab() {
  const insets = useSafeAreaInsets();
  const { mode, setMode, colors, isDark } = useTheme();
  const [email, setEmail] = useState("rider@rideza.com");

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  useEffect(() => {
    const loadEmail = async () => {
      const storedEmail = await AsyncStorage.getItem("@user_email");
      if (storedEmail) setEmail(storedEmail);
    };

    void loadEmail();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["@user_token", "@user_email", "@firebase_uid"]);
    router.replace("/(auth)/login");
  };

  const handleResetOnboarding = async () => {
    await AsyncStorage.multiRemove([
      "hasOnboarded",
      "@has_onboarded",
      "@user_token",
      "@user_email",
      "@firebase_uid",
    ]);
    router.replace("/(onboarding)");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 82 },
        ]}
      >
        <Text style={styles.title}>Account</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={30} color={colors.primary} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>RideZA Rider</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.plusButton,
            { opacity: pressed ? 0.86 : 1 },
          ]}
          onPress={() => router.push("/(main)/rideza-plus")}
          accessibilityRole="button"
          accessibilityLabel="Open RideZA plus"
        >
          <View style={styles.plusIconBox}>
            <MaterialIcons name="workspace-premium" size={22} color={colors.primary} />
          </View>
          <View style={styles.plusCopy}>
            <Text style={styles.plusTitle}>RideZA+</Text>
            <Text style={styles.plusSubtitle}>
              VIP monthly ride credit and premium benefits
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(item => {
              const active = mode === item.mode;

              return (
                <Pressable
                  key={item.mode}
                  onPress={() => setMode(item.mode)}
                  style={({ pressed }) => [
                    styles.themeButton,
                    active && styles.themeButtonActive,
                    { opacity: pressed ? 0.82 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Set ${item.label} theme`}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={17}
                    color={active ? colors.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.themeButtonText,
                      active && styles.themeButtonTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.currentTheme}>
            Current: {isDark ? "dark" : "light"}
          </Text>
        </View>

        <View style={styles.menuList}>
          {MENU_ITEMS.map(item => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                { opacity: pressed ? 0.78 : 1 },
              ]}
              onPress={() => {
                if (item.label === "Help & Support") {
                  router.push("/(main)/help-support");
                  return;
                }
                Alert.alert(item.label, "This section is ready for the next implementation pass.");
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.menuIconBox}>
                <MaterialIcons name={item.icon} size={20} color={colors.muted} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              { opacity: pressed ? 0.86 : 1 },
            ]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <MaterialIcons name="logout" size={20} color="#FFFFFF" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.resetButton,
              { opacity: pressed ? 0.82 : 1 },
            ]}
            onPress={handleResetOnboarding}
            accessibilityRole="button"
            accessibilityLabel="Reset onboarding"
          >
            <MaterialIcons name="restart-alt" size={19} color={colors.muted} />
            <Text style={styles.resetButtonText}>Reset Onboarding</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>RideZA v{appVersion} - Made in South Africa</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 22,
    },
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
    },
    profileCard: {
      marginTop: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      padding: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37,99,235,0.11)",
    },
    profileCopy: {
      flex: 1,
      minWidth: 0,
    },
    profileName: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },
    profileEmail: {
      marginTop: 3,
      fontSize: 14,
      fontWeight: "600",
      color: colors.muted,
    },
    section: {
      marginTop: 24,
    },
    plusButton: {
      marginTop: 14,
      minHeight: 72,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    plusIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37,99,235,0.11)",
    },
    plusCopy: {
      flex: 1,
      minWidth: 0,
    },
    plusTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },
    plusSubtitle: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    sectionTitle: {
      marginBottom: 10,
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
    },
    themeRow: {
      flexDirection: "row",
      gap: 8,
    },
    themeButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 8,
    },
    themeButtonActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(37,99,235,0.08)",
    },
    themeButtonText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.muted,
    },
    themeButtonTextActive: {
      color: colors.primary,
    },
    currentTheme: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    menuList: {
      marginTop: 24,
      gap: 4,
    },
    menuItem: {
      minHeight: 64,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    menuIconBox: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSolid,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuCopy: {
      flex: 1,
      minWidth: 0,
    },
    menuLabel: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    menuSubtitle: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    actions: {
      marginTop: 24,
      gap: 10,
    },
    logoutButton: {
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    logoutButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "900",
    },
    resetButton: {
      height: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    resetButtonText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "800",
    },
    footer: {
      marginTop: 24,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
  });
}
