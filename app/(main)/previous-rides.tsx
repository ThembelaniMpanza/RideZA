import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function PreviousRidesTab() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Previous Rides</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Ride history list goes here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { marginTop: 8 },
});
