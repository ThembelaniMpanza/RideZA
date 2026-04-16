import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function DriverCallScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    driverName?: string;
    driverCar?: string;
    driverPlate?: string;
  }>();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(current => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const durationLabel = useMemo(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [seconds]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Pressable onPress={() => router.back()} style={styles.closeBtn}>
        <MaterialIcons name="close" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.center}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(params.driverName ?? "D")
              .split(" ")
              .map(part => part[0])
              .join("")
              .slice(0, 2)}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>
          {params.driverName ?? "Driver"}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {params.driverCar ?? "Vehicle"} • {params.driverPlate ?? "Plate unavailable"}
        </Text>
        <Text style={[styles.status, { color: colors.primary }]}>In-app call • {durationLabel}</Text>
      </View>

      <View style={styles.actions}>
        <View style={[styles.actionCircle, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}>
          <MaterialIcons name="mic-off" size={22} color={colors.text} />
        </View>
        <View style={[styles.actionCircle, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}>
          <MaterialIcons name="volume-up" size={22} color={colors.text} />
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.endCall, { backgroundColor: colors.danger }]}
        >
          <MaterialIcons name="call-end" size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: "#132137",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
  name: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: "800",
  },
  meta: {
    marginTop: 8,
    fontSize: 14,
  },
  status: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
  },
  actionCircle: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  endCall: {
    width: 68,
    height: 68,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
