import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import type { ThemeColors } from "../../src/theme/theme";

type Ride = {
  id: string;
  date: string;
  pickup: string;
  destination: string;
  fare: string;
  status: "completed" | "cancelled";
  vehicle: string;
  duration: string;
};

const DEMO_RIDES: Ride[] = [
  {
    id: "1",
    date: "Today, 14:30",
    pickup: "Sandton City Mall",
    destination: "OR Tambo International Airport",
    fare: "R285",
    status: "completed",
    vehicle: "RideZA Comfort",
    duration: "35 min",
  },
  {
    id: "2",
    date: "Yesterday, 09:15",
    pickup: "Rosebank Gautrain Station",
    destination: "Braamfontein, Johannesburg",
    fare: "R68",
    status: "completed",
    vehicle: "RideZA Go",
    duration: "18 min",
  },
  {
    id: "3",
    date: "12 Apr, 18:45",
    pickup: "Melrose Arch",
    destination: "Fourways Mall",
    fare: "R125",
    status: "completed",
    vehicle: "RideZA Go",
    duration: "22 min",
  },
  {
    id: "4",
    date: "10 Apr, 07:30",
    pickup: "Home - Midrand",
    destination: "Johannesburg CBD",
    fare: "R0",
    status: "cancelled",
    vehicle: "RideZA Go",
    duration: "-",
  },
  {
    id: "5",
    date: "8 Apr, 20:00",
    pickup: "Montecasino",
    destination: "Bryanston",
    fare: "R95",
    status: "completed",
    vehicle: "RideZA Premium",
    duration: "15 min",
  },
];

export default function PreviousRidesTab() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const renderRide: ListRenderItem<Ride> = ({ item }) => {
    const isCompleted = item.status === "completed";

    return (
      <Pressable
        style={({ pressed }) => [
          styles.rideCard,
          { opacity: pressed ? 0.82 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.status} ride from ${item.pickup} to ${item.destination}`}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.dateRow}>
            <MaterialIcons name="schedule" size={14} color={colors.muted} />
            <Text style={styles.dateText}>{item.date}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isCompleted
                  ? "rgba(22,163,74,0.12)"
                  : "rgba(225,29,72,0.12)",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isCompleted ? "#16A34A" : colors.danger },
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.routeRail}>
            <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, { backgroundColor: colors.danger }]} />
          </View>

          <View style={styles.routeCopy}>
            <Text style={styles.pickupText} numberOfLines={1}>
              {item.pickup}
            </Text>
            <Text style={styles.destinationText} numberOfLines={1}>
              {item.destination}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            <View style={styles.vehicleRow}>
              <MaterialIcons name="directions-car" size={14} color={colors.muted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.vehicle}
              </Text>
            </View>
            <Text style={styles.metaText}>{item.duration}</Text>
          </View>

          <View style={styles.fareRow}>
            <Text style={styles.fareText}>{item.fare}</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={DEMO_RIDES}
        keyExtractor={item => item.id}
        renderItem={renderRide}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 82 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Previous Rides</Text>
            <Text style={styles.subtitle}>Your ride history</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    header: {
      marginBottom: 22,
    },
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 14,
      color: colors.muted,
    },
    separator: {
      height: 12,
    },
    rideCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      padding: 14,
      shadowColor: "#000000",
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
    },
    dateText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    routeRow: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    routeRail: {
      width: 10,
      alignItems: "center",
      paddingTop: 5,
    },
    routeDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    routeLine: {
      width: 2,
      height: 26,
      marginVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.border,
    },
    routeCopy: {
      flex: 1,
      gap: 8,
    },
    pickupText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    destinationText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.muted,
    },
    cardFooter: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    vehicleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      flexShrink: 1,
      minWidth: 0,
    },
    metaText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    fareRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    fareText: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
    },
  });
}
