import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function RideOptionsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    pickupLat?: string;
    pickupLng?: string;
    pickupLabel?: string;
    destLat?: string;
    destLng?: string;
    destLabel?: string;
    rideClass?: string;
    rideCarType?: string;
    rideEta?: string;
    ridePassengers?: string;
    ridePrice?: string;
    paymentMethod?: string;
    paymentDetails?: string;
  }>();

  const pickup = useMemo(() => {
    const lat = params.pickupLat ? Number(params.pickupLat) : NaN;
    const lng = params.pickupLng ? Number(params.pickupLng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [params.pickupLat, params.pickupLng]);

  const dest = useMemo(() => {
    const lat = params.destLat ? Number(params.destLat) : NaN;
    const lng = params.destLng ? Number(params.destLng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [params.destLat, params.destLng]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back-ios" size={22} color="#132137" />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Ride Options</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Pickup spot</Text>
        <Text style={[styles.cardText, { color: colors.text }]}>
          {params.pickupLabel ? params.pickupLabel : "Selected on map"}
        </Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {pickup ? `${pickup.lat.toFixed(6)}, ${pickup.lng.toFixed(6)}` : "Missing coordinates"}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Destination</Text>
        <Text style={[styles.cardText, { color: colors.text }]}>
          {params.destLabel ? params.destLabel : "Selected on map"}
        </Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {dest ? `${dest.lat.toFixed(6)}, ${dest.lng.toFixed(6)}` : "Missing coordinates"}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Selected ride</Text>
        <Text style={[styles.cardText, { color: colors.text }]}>
          {params.rideClass ? params.rideClass : "No ride class selected"}
        </Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {params.rideCarType ? params.rideCarType : "Vehicle type unavailable"}
        </Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {params.ridePassengers && params.rideEta
            ? `${params.ridePassengers} passengers • Pickup in ${params.rideEta} min`
            : "Pickup timing unavailable"}
        </Text>
        <Text style={[styles.price, { color: colors.text }]}>
          {params.ridePrice ? `R ${params.ridePrice}` : "Fare unavailable"}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Payment</Text>
        <Text style={[styles.cardText, { color: colors.text }]}>
          {params.paymentMethod ? params.paymentMethod : "No payment method selected"}
        </Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {params.paymentDetails ? params.paymentDetails : "Payment details unavailable"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#132137",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee7db",
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#132137",
  },
  cardText: {
    marginTop: 8,
    fontSize: 14,
    color: "#1f1f1f",
  },
  small: {
    marginTop: 8,
    fontSize: 12,
    color: "#6a6a6a",
  },
  price: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "800",
    color: "#132137",
  },
});
