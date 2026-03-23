import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

const MAP_STYLE_NO_LABELS = [
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

const MAP_STYLE_DARK_BASE = [
  { elementType: "geometry", stylers: [{ color: "#0b0d12" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#F5F7FF" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0d12" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b1e29" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1626" }] },
];

const MAP_STYLE_MINIMAL_SEARCH = [
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }, { color: "#1b1b1b" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.stroke",
    stylers: [{ visibility: "on" }, { color: "#ffffff" }, { weight: 3 }],
  },
];

const MAP_STYLE_STREETS = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

type LatLng = { latitude: number; longitude: number };
type Suggestion = LatLng & { key: string; label: string };

function toPrettyAddress(a: Location.LocationGeocodedAddress | undefined) {
  if (!a) return "";
  return [a.name, a.street, a.city, a.region].filter(Boolean).join(", ");
}

export default function RideTab() {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const geocodeRequestId = useRef(0);

  const [pickupLocation, setPickupLocation] = useState<LatLng | null>(null);
  const [pickupLabel, setPickupLabel] = useState("Current location");

  const [destinationText, setDestinationText] = useState("");
  const [destinationLocation, setDestinationLocation] = useState<LatLng | null>(
    null,
  );
  const [destinationLabel, setDestinationLabel] = useState("");

  const [isEditingDestination, setIsEditingDestination] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [isDestinationConfirmed, setIsDestinationConfirmed] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);

  const [region, setRegion] = useState<Region>({
    latitude: -26.2041,
    longitude: 28.0473,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const hasDestinationText = destinationText.trim().length > 0;
  const showSuggestions = isEditingDestination && hasDestinationText && !isDestinationConfirmed;

  const isZoomedIn = region.longitudeDelta <= 0.02;
  const mapStyle = useMemo(() => {
    const base = isDark ? (MAP_STYLE_DARK_BASE as any[]) : [];
    let variant: any[] = [];
    if (!hasDestinationText) variant = MAP_STYLE_NO_LABELS as any[];
    else if (routeCoords.length >= 2 || isDestinationConfirmed || isZoomedIn)
      variant = MAP_STYLE_STREETS as any[];
    else variant = MAP_STYLE_MINIMAL_SEARCH as any[];
    return [...base, ...variant] as any;
  }, [
    isDark,
    hasDestinationText,
    isDestinationConfirmed,
    isZoomedIn,
    routeCoords.length,
  ]);

  const placeholder = useMemo(() => "Enter destination address", []);

  // Get and track current location for pickup.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const here = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setPickupLocation(here);
      const nextRegion = {
        latitude: here.latitude,
        longitude: here.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 650);

      try {
        const rev = await Location.reverseGeocodeAsync(here);
        const line = toPrettyAddress(rev[0]);
        if (line) setPickupLabel(line);
      } catch {
        // ignore
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 15,
        },
        loc => {
          // Only auto-follow pickup when not in the middle of destination flow.
          if (hasDestinationText || isEditingDestination || isDestinationConfirmed) return;
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setPickupLocation(coords);
          const nextRegion = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
          };
          setRegion(nextRegion);
          mapRef.current?.animateToRegion(nextRegion, 500);
        },
      );
    };

    start();
    return () => subscription?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suggestions (debounced) from typed destination.
  useEffect(() => {
    const query = destinationText.trim();
    if (query.length < 3 || isDestinationConfirmed) {
      setSuggestions([]);
      return;
    }

    const requestId = ++geocodeRequestId.current;
    const handle = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const results = await Location.geocodeAsync(query);
        if (geocodeRequestId.current !== requestId) return;
        if (!results.length) {
          setSuggestions([]);
          return;
        }

        const top = results.slice(0, 6);
        const suggested = await Promise.all(
          top.map(async (r, index) => {
            const coords = { latitude: r.latitude, longitude: r.longitude };
            try {
              const rev = await Location.reverseGeocodeAsync(coords);
              const label = toPrettyAddress(rev[0]) || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
              return { key: `${index}-${coords.latitude}-${coords.longitude}`, label, ...coords } satisfies Suggestion;
            } catch {
              return {
                key: `${index}-${coords.latitude}-${coords.longitude}`,
                label: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
                ...coords,
              } satisfies Suggestion;
            }
          }),
        );

        if (geocodeRequestId.current !== requestId) return;
        setSuggestions(suggested);
      } finally {
        if (geocodeRequestId.current === requestId) setIsGeocoding(false);
      }
    }, 550);

    return () => clearTimeout(handle);
  }, [destinationText, isDestinationConfirmed]);

  // Route fetch (OSRM demo). Falls back to straight line when offline.
  useEffect(() => {
    const run = async () => {
      if (!pickupLocation || !destinationLocation) return;
      setIsRouting(true);
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${pickupLocation.longitude},${pickupLocation.latitude};` +
          `${destinationLocation.longitude},${destinationLocation.latitude}` +
          `?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("route");
        const json: any = await res.json();
        const coords: [number, number][] = json?.routes?.[0]?.geometry?.coordinates ?? [];
        const line = coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
        if (line.length < 2) throw new Error("empty");
        setRouteCoords(line);
        mapRef.current?.fitToCoordinates(line, {
          edgePadding: {
            top: 80 + insets.top,
            bottom: 320,
            left: 50,
            right: 50,
          },
          animated: true,
        });
      } catch {
        const line = [pickupLocation, destinationLocation];
        setRouteCoords(line);
        mapRef.current?.fitToCoordinates(line, {
          edgePadding: {
            top: 80 + insets.top,
            bottom: 320,
            left: 50,
            right: 50,
          },
          animated: true,
        });
      } finally {
        setIsRouting(false);
      }
    };
    run();
  }, [pickupLocation, destinationLocation, insets.top]);

  const resetDestinationFlow = () => {
    setIsDestinationConfirmed(false);
    setDestinationLocation(null);
    setDestinationLabel("");
    setRouteCoords([]);
  };

  const confirmDestination = (coords: LatLng, label: string) => {
    setDestinationLocation(coords);
    setDestinationLabel(label);
    setDestinationText(label);
    setIsDestinationConfirmed(true);
    setIsEditingDestination(false);

    const tight = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    setRegion(tight);
    mapRef.current?.animateToRegion(tight, 650);
  };

  const submitDestination = async () => {
    const query = destinationText.trim();
    if (query.length < 3) return;

    // Use first suggestion if present.
    const top = suggestions[0];
    if (top) {
      confirmDestination({ latitude: top.latitude, longitude: top.longitude }, top.label);
      return;
    }

    const requestId = ++geocodeRequestId.current;
    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (geocodeRequestId.current !== requestId) return;
      if (!results.length) return;
      const first = results[0];
      confirmDestination({ latitude: first.latitude, longitude: first.longitude }, query);
    } finally {
      if (geocodeRequestId.current === requestId) setIsGeocoding(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <MapView
        ref={ref => {
          mapRef.current = ref;
        }}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        zoomEnabled
        scrollEnabled
        rotateEnabled
        pitchEnabled
        customMapStyle={mapStyle}
      />

      {routeCoords.length >= 2 && (
        <Polyline
          coordinates={routeCoords}
          strokeWidth={6}
          strokeColor="#2563EB"
        />
      )}

      {pickupLocation && (
        <Marker
          coordinate={pickupLocation}
          pinColor="#132137"
          draggable={isDestinationConfirmed}
          onDragEnd={async e => {
            const coords = e.nativeEvent.coordinate;
            setPickupLocation(coords);
            try {
              const rev = await Location.reverseGeocodeAsync(coords);
              const line = toPrettyAddress(rev[0]);
              if (line) setPickupLabel(line);
            } catch {
              // ignore
            }
          }}
        />
      )}

      {destinationLocation && (
        <Marker coordinate={destinationLocation} pinColor="#E11D48" />
      )}

      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        {!hasDestinationText && (
          <View style={styles.header}>
            <Text style={[styles.h1, { color: colors.text }]}>Where are you going?</Text>
            <Text style={[styles.h2, { color: colors.muted }]}>Type an address to get started.</Text>
          </View>
        )}

        <BlurView intensity={48} tint={isDark ? "dark" : "light"} style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardGlassBorder} />

          <View style={styles.inputRow}>
            <MaterialIcons name="my-location" size={18} color={colors.text} />
            <TextInput
              style={[
                styles.input,
                styles.inputDisabled,
                { backgroundColor: colors.cardSolid, color: colors.muted, borderColor: colors.border },
              ]}
              value={pickupLabel}
              editable={false}
              selectTextOnFocus={false}
            />
          </View>

          <View style={[styles.inputRow, { marginTop: 10 }]}>
            <MaterialIcons name="place" size={18} color={colors.danger} />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.cardSolid, color: colors.text, borderColor: colors.border },
              ]}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              value={destinationText}
              onChangeText={text => {
                setDestinationText(text);
                resetDestinationFlow();
              }}
              onFocus={() => setIsEditingDestination(true)}
              onBlur={() => setIsEditingDestination(false)}
              returnKeyType="search"
              onSubmitEditing={submitDestination}
              autoCorrect={false}
              autoCapitalize="none"
            />

            {hasDestinationText && (
              <Pressable
                style={({ pressed }) => [
                  styles.iconBtn,
                  { borderColor: colors.border, backgroundColor: colors.cardSolid },
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                onPress={() => {
                  setDestinationText("");
                  resetDestinationFlow();
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear destination"
              >
                <MaterialIcons name="close" size={20} color={colors.text} />
              </Pressable>
            )}

            {!hasDestinationText && (
              <Pressable
                style={({ pressed }) => [
                  styles.searchBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={submitDestination}
                accessibilityRole="button"
                accessibilityLabel="Search destination"
              >
                {isGeocoding ? (
                  <MaterialIcons name="hourglass-top" size={20} color="#ffffff" />
                ) : (
                  <MaterialIcons name="search" size={22} color="#ffffff" />
                )}
              </Pressable>
            )}
          </View>

          {!hasDestinationText && (
            <Text style={styles.helper}>
              Example: "Sandton City" or "12 Main Rd, Cape Town"
            </Text>
          )}
        </BlurView>

        {showSuggestions && (
          <BlurView intensity={48} tint={isDark ? "dark" : "light"} style={[styles.suggestionsCard, { backgroundColor: colors.card }]}>
            <View style={styles.cardGlassBorder} />

            {suggestions.map(item => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => confirmDestination(item, item.label)}
              >
                <MaterialIcons name="location-on" size={18} color="#132137" />
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}

            {!suggestions.length && (
              <View style={styles.suggestionEmpty}>
                <Text style={styles.suggestionEmptyText}>
                  {isGeocoding ? "Searching..." : "No matches yet. Keep typing."}
                </Text>
              </View>
            )}
          </BlurView>
        )}

        {isDestinationConfirmed && (
          <BlurView intensity={48} tint={isDark ? "dark" : "light"} style={[styles.confirmCard, { backgroundColor: colors.card }]}>
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Confirm pickup spot</Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              We drew a route from your current location to the destination. Drag the pickup pin if needed, then confirm.
            </Text>
            <Pressable
              style={({ pressed }) => [
                [styles.confirmBtn, { backgroundColor: colors.primary }],
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => {
                if (!pickupLocation || !destinationLocation) return;

                // Snap-zoom close to pickup right before navigation.
                const tight = {
                  latitude: pickupLocation.latitude,
                  longitude: pickupLocation.longitude,
                  latitudeDelta: 0.0025,
                  longitudeDelta: 0.0025,
                };
                setRegion(tight);
                mapRef.current?.animateToRegion(tight, 450);

                setTimeout(() => {
                  router.push({
                    pathname: "/(main)/ride-options",
                    params: {
                      pickupLat: String(pickupLocation.latitude),
                      pickupLng: String(pickupLocation.longitude),
                      pickupLabel,
                      destLat: String(destinationLocation.latitude),
                      destLng: String(destinationLocation.longitude),
                      destLabel: destinationLabel || destinationText.trim() || "Destination",
                    },
                  });
                }, 480);
              }}
              disabled={!pickupLocation || !destinationLocation || isRouting}
              accessibilityRole="button"
              accessibilityLabel="Confirm pickup spot"
            >
              <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                {isRouting ? "Calculating route..." : "Confirm pickup spot"}
              </Text>
            </Pressable>
          </BlurView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  container: { flex: 1, paddingHorizontal: 16 },
  header: { paddingTop: 16, paddingBottom: 12 },
  h1: { fontSize: 28, fontWeight: "800", color: "#0f1220" },
  h2: { marginTop: 6, fontSize: 14, color: "#1a1a1a" },

  card: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  cardGlassBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    color: "#111111",
  },
  inputDisabled: {
    backgroundColor: "rgba(255,255,255,0.55)",
    color: "#2a2a2a",
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#132137",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  helper: { marginTop: 10, fontSize: 12, color: "#1f1f1f" },

  suggestionsCard: {
    marginTop: 10,
    maxHeight: 260,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    overflow: "hidden",
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  suggestionText: {
    flex: 1,
    color: "#0f1220",
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionEmpty: { paddingHorizontal: 14, paddingVertical: 12 },
  suggestionEmptyText: { color: "#1f1f1f", fontSize: 12 },

  confirmCard: {
    marginTop: "auto",
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  confirmTitle: { fontSize: 16, fontWeight: "800", color: "#132137" },
  confirmText: { marginTop: 6, fontSize: 13, color: "#1f1f1f" },
  confirmBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#132137",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
});
