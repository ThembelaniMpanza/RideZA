import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function AccountTab() {
  const insets = useSafeAreaInsets();
  const { mode, setMode, colors, isDark } = useTheme();

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>Theme + test actions</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Theme</Text>
        <View style={styles.row}>
          {(["system", "light", "dark"] as const).map(item => (
            <Pressable
              key={item}
              onPress={() => setMode(item)}
              style={({ pressed }) => [
                styles.pill,
                mode === item && styles.pillActive,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.pillText, mode === item && styles.pillTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.small}>
          Current: {isDark ? "dark" : "light"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Test Flow</Text>
        <Pressable
          style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={async () => {
            await AsyncStorage.multiRemove(["@user_token"]);
            router.replace("/(auth)/login");
          }}
        >
          <Text style={styles.btnText}>Logout</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnOutline, { opacity: pressed ? 0.85 : 1 }]}
          onPress={async () => {
            await AsyncStorage.multiRemove(["hasOnboarded", "@user_token"]);
            router.replace("/(onboarding)");
          }}
        >
          <Text style={styles.btnOutlineText}>Reset Onboarding</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    title: { fontSize: 24, fontWeight: "800", color: colors.text },
    subtitle: { marginTop: 8, color: colors.muted },
    card: {
      marginTop: 14,
      backgroundColor: colors.cardSolid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    cardTitle: { color: colors.text, fontWeight: "800" },
    row: { flexDirection: "row", gap: 8, marginTop: 10 },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { color: colors.text, fontWeight: "700" },
    pillTextActive: { color: colors.onPrimary },
    small: { marginTop: 10, color: colors.muted, fontSize: 12 },
    btn: {
      marginTop: 12,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: { color: colors.onPrimary, fontWeight: "800" },
    btnOutline: {
      marginTop: 10,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    btnOutlineText: { color: colors.text, fontWeight: "800" },
  });
}
