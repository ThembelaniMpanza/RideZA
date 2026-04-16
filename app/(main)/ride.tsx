import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
type ActiveField = "pickup" | "destination" | null;
type RideClassId = "standard" | "premium" | "economy" | "sevenSeater";

type RideOption = {
  id: RideClassId;
  title: string;
  carType: string;
  passengers: number;
  etaMinutes: number;
  price: number;
  image: ImageSourcePropType;
};

type RouteSummary = {
  distanceKm: number;
  durationMinutes: number;
};

type PaymentMethodId = "cash" | "visaPersonal" | "businessMastercard";

type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  details: string;
  type: "cash" | "card";
  accent: string;
};

type DriverDetails = {
  name: string;
  car: string;
  plate: string;
  rating: number;
  etaMinutes: number;
};

const REVIEW_TAGS = ["Good attitude", "Cool person", "Polite"];
const TIP_PRESETS = [10, 20, 50];

function toPrettyAddress(a: Location.LocationGeocodedAddress | undefined) {
  if (!a) return "";
  return [a.name, a.street, a.city, a.region].filter(Boolean).join(", ");
}

function haversineDistanceKm(a: LatLng, b: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function getPointAlongRoute(route: LatLng[], progress: number) {
  if (route.length === 0) return null;
  if (route.length === 1) return route[0];

  const clamped = Math.min(1, Math.max(0, progress));
  const scaled = clamped * (route.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(index + 1, route.length - 1);
  const localProgress = scaled - index;
  const start = route[index];
  const end = route[nextIndex];

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * localProgress,
    longitude: start.longitude + (end.longitude - start.longitude) * localProgress,
  };
}

function getHeadingAlongRoute(route: LatLng[], progress: number) {
  if (route.length < 2) return 0;

  const clamped = Math.min(0.999, Math.max(0, progress));
  const scaled = clamped * (route.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(index + 1, route.length - 1);
  const start = route[index];
  const end = route[nextIndex];

  const latitudeDelta = end.latitude - start.latitude;
  const longitudeDelta = end.longitude - start.longitude;

  return (Math.atan2(longitudeDelta, latitudeDelta) * 180) / Math.PI;
}

function buildLinearRoute(start: LatLng, end: LatLng, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    return {
      latitude: start.latitude + (end.latitude - start.latitude) * progress,
      longitude: start.longitude + (end.longitude - start.longitude) * progress,
    };
  });
}

function offsetCoordinate(point: LatLng, latOffset: number, lngOffset: number) {
  return {
    latitude: point.latitude + latOffset,
    longitude: point.longitude + lngOffset,
  };
}

export default function RideTab() {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const geocodeRequestId = useRef(0);
  const routePulse = useRef(new Animated.Value(0)).current;
  const driverProgressAnim = useRef(new Animated.Value(0)).current;
  const hasDestinationTextRef = useRef(false);
  const isEditingPickupRef = useRef(false);
  const isEditingDestinationRef = useRef(false);
  const isDestinationConfirmedRef = useRef(false);

  const [pickupLocation, setPickupLocation] = useState<LatLng | null>(null);
  const [pickupLabel, setPickupLabel] = useState("Current location");
  const [pickupText, setPickupText] = useState("Current location");

  const [destinationText, setDestinationText] = useState("");
  const [destinationLocation, setDestinationLocation] = useState<LatLng | null>(
    null,
  );
  const [destinationLabel, setDestinationLabel] = useState("");

  const [isEditingPickup, setIsEditingPickup] = useState(false);
  const [isEditingDestination, setIsEditingDestination] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeField, setActiveField] = useState<ActiveField>(null);

  const [isDestinationConfirmed, setIsDestinationConfirmed] = useState(false);
  const [isPickupConfirmationStep, setIsPickupConfirmationStep] = useState(false);
  const [isPrecisePickupStep, setIsPrecisePickupStep] = useState(false);
  const [isFindingRide, setIsFindingRide] = useState(false);
  const [isDriverFound, setIsDriverFound] = useState(false);
  const [isDriverWaiting, setIsDriverWaiting] = useState(false);
  const [isTripInProgress, setIsTripInProgress] = useState(false);
  const [isTripCompleted, setIsTripCompleted] = useState(false);
  const [isAwaitingCashConfirmation, setIsAwaitingCashConfirmation] = useState(false);
  const [isConfirmingCashPayment, setIsConfirmingCashPayment] = useState(false);
  const [isReviewStage, setIsReviewStage] = useState(false);
  const [isThankYouStage, setIsThankYouStage] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routePulseProgress, setRoutePulseProgress] = useState(0);
  const [driverProgress, setDriverProgress] = useState(0);
  const [driverRouteCoords, setDriverRouteCoords] = useState<LatLng[]>([]);
  const [driverDetails, setDriverDetails] = useState<DriverDetails | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [tripProgress, setTripProgress] = useState(0);
  const [tripHeading, setTripHeading] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedReviewTags, setSelectedReviewTags] = useState<string[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [isFareSheetExpanded, setIsFareSheetExpanded] = useState(true);
  const [selectedRideClass, setSelectedRideClass] = useState<RideClassId>("standard");
  const [isRideSelectionConfirmed, setIsRideSelectionConfirmed] = useState(false);
  const [isPaymentSheetExpanded, setIsPaymentSheetExpanded] = useState(true);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] =
    useState<PaymentMethodId>("cash");
  const shouldResetRouteFlowRef = useRef(true);
  const tripProgressAnim = useRef(new Animated.Value(0)).current;

  const [region, setRegion] = useState<Region>({
    latitude: -26.2041,
    longitude: 28.0473,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  });

  const hasPickupText = pickupText.trim().length > 0;
  const hasDestinationText = destinationText.trim().length > 0;
  const activeSearchText =
    activeField === "pickup" ? pickupText.trim() : destinationText.trim();
  const showSuggestions =
    activeField !== null &&
    activeSearchText.length > 0 &&
    (activeField === "pickup" || !isDestinationConfirmed);
  const showPlanningUi =
    !isPrecisePickupStep &&
    !isFindingRide &&
    !isDriverFound &&
    !isDriverWaiting &&
    !isTripInProgress &&
    !isTripCompleted &&
    !isReviewStage &&
    !isThankYouStage;

  useEffect(() => {
    shouldResetRouteFlowRef.current =
      !isPrecisePickupStep &&
      !isFindingRide &&
      !isDriverFound &&
      !isDriverWaiting &&
      !isTripInProgress &&
      !isTripCompleted &&
      !isReviewStage &&
      !isThankYouStage;
  }, [
    isPrecisePickupStep,
    isFindingRide,
    isDriverFound,
    isDriverWaiting,
    isTripInProgress,
    isTripCompleted,
    isReviewStage,
    isThankYouStage,
  ]);

  useEffect(() => {
    hasDestinationTextRef.current = hasDestinationText;
    isEditingPickupRef.current = isEditingPickup;
    isEditingDestinationRef.current = isEditingDestination;
    isDestinationConfirmedRef.current = isDestinationConfirmed;
  }, [
    hasDestinationText,
    isDestinationConfirmed,
    isEditingDestination,
    isEditingPickup,
  ]);

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
  const rideOptions = useMemo<RideOption[]>(() => {
    if (!routeSummary) return [];

    const distance = routeSummary.distanceKm;
    const duration = routeSummary.durationMinutes;

    const makePrice = (base: number, perKm: number, multiplier = 1) =>
      Number((base + distance * perKm * multiplier).toFixed(2));

    return [
      {
        id: "economy",
        title: "Economy",
        carType: "Hyundai i20 or similar",
        passengers: 4,
        etaMinutes: Math.max(3, Math.round(duration * 0.55)),
        price: makePrice(24, 7.5),
        image: require("../../assets/images/VehiclesPack/Hyundai i20.png"),
      },
      {
        id: "standard",
        title: "Standard",
        carType: "Toyota Corolla or similar",
        passengers: 4,
        etaMinutes: Math.max(2, Math.round(duration * 0.45)),
        price: makePrice(34, 9),
        image: require("../../assets/images/VehiclesPack/toyota corolla.png"),
      },
      {
        id: "premium",
        title: "Premium",
        carType: "Mercedes-Benz C-Class or similar",
        passengers: 4,
        etaMinutes: Math.max(4, Math.round(duration * 0.65)),
        price: makePrice(58, 12.5, 1.15),
        image: require("../../assets/images/VehiclesPack/Mercedes-Benz C-Class.png"),
      },
      {
        id: "sevenSeater",
        title: "7 Seater",
        carType: "Cadillac Escalade or similar",
        passengers: 7,
        etaMinutes: Math.max(5, Math.round(duration * 0.7)),
        price: makePrice(72, 14, 1.22),
        image: require("../../assets/images/VehiclesPack/Cadillac Escalade.png"),
      },
    ];
  }, [routeSummary]);
  const selectedRide = useMemo(
    () => rideOptions.find(option => option.id === selectedRideClass) ?? null,
    [rideOptions, selectedRideClass],
  );
  const paymentMethods = useMemo<PaymentMethod[]>(
    () => [
      {
        id: "cash",
        label: "Cash",
        details: "Pay the driver in cash at pickup or drop-off",
        type: "cash",
        accent: "#16A34A",
      },
      {
        id: "visaPersonal",
        label: "Visa Personal",
        details: "•••• 4821",
        type: "card",
        accent: "#2563EB",
      },
      {
        id: "businessMastercard",
        label: "Business Mastercard",
        details: "•••• 1904",
        type: "card",
        accent: "#D97706",
      },
    ],
    [],
  );
  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find(method => method.id === selectedPaymentMethodId) ??
      paymentMethods[0],
    [paymentMethods, selectedPaymentMethodId],
  );
  const isCashPayment = selectedPaymentMethod.type === "cash";
  const pulseRouteCoords = useMemo(() => {
    if (routeCoords.length < 2) return [];
    const lastIndex = Math.max(
      1,
      Math.min(routeCoords.length - 1, Math.floor(routePulseProgress * (routeCoords.length - 1))),
    );
    return routeCoords.slice(0, lastIndex + 1);
  }, [routeCoords, routePulseProgress]);
  const pulseMarkerPoint = useMemo(
    () => getPointAlongRoute(routeCoords, routePulseProgress),
    [routeCoords, routePulseProgress],
  );
  const driverMarkerPoint = useMemo(
    () => getPointAlongRoute(driverRouteCoords, driverProgress),
    [driverRouteCoords, driverProgress],
  );
  const liveDriverEta = useMemo(() => {
    if (!driverDetails) return null;
    return Math.max(1, Math.ceil(driverDetails.etaMinutes * (1 - driverProgress)));
  }, [driverDetails, driverProgress]);
  const tripMarkerPoint = useMemo(
    () => getPointAlongRoute(routeCoords, tripProgress),
    [routeCoords, tripProgress],
  );

  useEffect(() => {
    const listenerId = routePulse.addListener(({ value }) => {
      setRoutePulseProgress(value);
    });

    return () => {
      routePulse.removeListener(listenerId);
    };
  }, [routePulse]);

  useEffect(() => {
    const listenerId = driverProgressAnim.addListener(({ value }) => {
      setDriverProgress(value);
      setDriverHeading(getHeadingAlongRoute(driverRouteCoords, value));
    });

    return () => {
      driverProgressAnim.removeListener(listenerId);
    };
  }, [driverProgressAnim, driverRouteCoords]);

  useEffect(() => {
    const listenerId = tripProgressAnim.addListener(({ value }) => {
      setTripProgress(value);
      setTripHeading(getHeadingAlongRoute(routeCoords, value));
    });

    return () => {
      tripProgressAnim.removeListener(listenerId);
    };
  }, [tripProgressAnim, routeCoords]);

  useEffect(() => {
    if (!isFindingRide || routeCoords.length < 2) {
      routePulse.stopAnimation();
      routePulse.setValue(0);
      setRoutePulseProgress(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(routePulse, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: false,
      }),
    );

    routePulse.setValue(0);
    animation.start();

    return () => {
      animation.stop();
      routePulse.stopAnimation();
      routePulse.setValue(0);
    };
  }, [isFindingRide, routeCoords, routePulse]);

  useEffect(() => {
    if (!isFindingRide || !pickupLocation || !selectedRide) return;

    const timeout = setTimeout(() => {
      const hydrateDriverApproach = async () => {
        const start = offsetCoordinate(pickupLocation, 0.018, -0.02);
        let approachRoute = buildLinearRoute(start, pickupLocation, 26);
        let etaMinutes = Math.max(2, Math.round(selectedRide.etaMinutes * 0.8));

        try {
          const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${start.longitude},${start.latitude};` +
            `${pickupLocation.longitude},${pickupLocation.latitude}` +
            `?overview=full&geometries=geojson`;
          const response = await fetch(url);
          if (!response.ok) throw new Error("driver-route");
          const json: any = await response.json();
          const coordinates: [number, number][] =
            json?.routes?.[0]?.geometry?.coordinates ?? [];
          const routedLine = coordinates.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }));
          if (routedLine.length >= 2) {
            approachRoute = routedLine;
          }
          etaMinutes = Math.max(
            2,
            Math.round(((json?.routes?.[0]?.duration ?? etaMinutes * 60) as number) / 60),
          );
        } catch {
          // Fall back to a synthetic route if routing is unavailable.
        }

        setDriverRouteCoords(approachRoute);
        setDriverDetails({
          name: "Sibusiso M.",
          car: selectedRide.carType,
          plate: "ND 458-771",
          rating: 4.92,
          etaMinutes,
        });
        setIsFindingRide(false);
        setIsDriverFound(true);
      };

      void hydrateDriverApproach();
    }, 60000);

    return () => clearTimeout(timeout);
  }, [isFindingRide, pickupLocation, selectedRide]);

  useEffect(() => {
    if (!isDriverFound || driverRouteCoords.length < 2) {
      driverProgressAnim.stopAnimation();
      driverProgressAnim.setValue(0);
      setDriverProgress(0);
      setDriverHeading(0);
      return;
    }

    const animation = Animated.timing(driverProgressAnim, {
      toValue: 1,
      duration: 28000,
      useNativeDriver: false,
    });

    driverProgressAnim.setValue(0);
    animation.start();

    return () => {
      animation.stop();
      driverProgressAnim.stopAnimation();
    };
  }, [isDriverFound, driverRouteCoords, driverProgressAnim]);

  useEffect(() => {
    if (!isDriverFound || driverProgress < 1) return;

    setIsDriverFound(false);
    setIsDriverWaiting(true);
  }, [driverProgress, isDriverFound]);

  useEffect(() => {
    if (!isDriverWaiting) return;

    if (pickupLocation) {
      const focus = {
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      };
      setRegion(focus);
      mapRef.current?.animateToRegion(focus, 550);
    }

    const timeout = setTimeout(() => {
      setIsDriverWaiting(false);
      setIsTripInProgress(true);
      tripProgressAnim.setValue(0);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [isDriverWaiting, pickupLocation, tripProgressAnim]);

  useEffect(() => {
    if (!isTripInProgress || routeCoords.length < 2) {
      tripProgressAnim.stopAnimation();
      tripProgressAnim.setValue(0);
      setTripProgress(0);
      setTripHeading(0);
      return;
    }

    const animation = Animated.timing(tripProgressAnim, {
      toValue: 1,
      duration: Math.max(18000, (routeSummary?.durationMinutes ?? 4) * 4500),
      useNativeDriver: false,
    });

    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: {
        top: 100 + insets.top,
        bottom: 260,
        left: 60,
        right: 60,
      },
      animated: true,
    });
    tripProgressAnim.setValue(0);
    animation.start();

    return () => {
      animation.stop();
      tripProgressAnim.stopAnimation();
    };
  }, [insets.top, isTripInProgress, routeCoords, routeSummary?.durationMinutes, tripProgressAnim]);

  useEffect(() => {
    if (!isTripInProgress || tripProgress < 1) return;

    setIsTripInProgress(false);
    setIsTripCompleted(true);
    setIsAwaitingCashConfirmation(isCashPayment);
    setIsReviewStage(!isCashPayment);
  }, [isCashPayment, isTripInProgress, tripProgress]);

  useEffect(() => {
    if (!isConfirmingCashPayment) return;

    const timeout = setTimeout(() => {
      setIsConfirmingCashPayment(false);
      setIsAwaitingCashConfirmation(false);
      setIsReviewStage(true);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isConfirmingCashPayment]);

  useEffect(() => {
    if (!isThankYouStage) return;

    const timeout = setTimeout(() => {
      resetDestinationFlow();
      setIsThankYouStage(false);
      setDestinationText("");
      setSuggestions([]);
      setActiveField(null);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [isThankYouStage]);

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
        if (line) {
          setPickupLabel(line);
          setPickupText(line);
        }
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
          if (
            hasDestinationTextRef.current ||
            isEditingPickupRef.current ||
            isEditingDestinationRef.current ||
            isDestinationConfirmedRef.current
          ) {
            return;
          }
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

  // Suggestions (debounced) from typed pickup or destination input.
  useEffect(() => {
    const query = activeSearchText;
    if (
      !activeField ||
      query.length < 3 ||
      (activeField === "destination" && isDestinationConfirmed)
    ) {
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
  }, [activeField, activeSearchText, isDestinationConfirmed]);

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
        const route = json?.routes?.[0];
        const line = coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
        if (line.length < 2) throw new Error("empty");
        setRouteCoords(line);
        setRouteSummary({
          distanceKm: Math.max(1, Number(((route?.distance ?? 0) / 1000).toFixed(1))),
          durationMinutes: Math.max(2, Math.round((route?.duration ?? 0) / 60)),
        });
        if (shouldResetRouteFlowRef.current) {
          setIsFareSheetExpanded(true);
          setIsRideSelectionConfirmed(false);
          setIsPaymentSheetExpanded(true);
          setIsPickupConfirmationStep(false);
          setIsPrecisePickupStep(false);
          setIsFindingRide(false);
          setIsDriverFound(false);
          setIsDriverWaiting(false);
          setIsTripInProgress(false);
          setIsTripCompleted(false);
          setIsAwaitingCashConfirmation(false);
          setIsConfirmingCashPayment(false);
          setIsReviewStage(false);
          setIsThankYouStage(false);
        }
        if (!isPrecisePickupStep) {
          mapRef.current?.fitToCoordinates(line, {
            edgePadding: {
              top: 80 + insets.top,
              bottom: 320,
              left: 50,
              right: 50,
            },
            animated: true,
          });
        }
      } catch {
        const line = [pickupLocation, destinationLocation];
        const fallbackDistanceKm = haversineDistanceKm(pickupLocation, destinationLocation);
        setRouteCoords(line);
        setRouteSummary({
          distanceKm: Math.max(1, Number(fallbackDistanceKm.toFixed(1))),
          durationMinutes: Math.max(3, Math.round((fallbackDistanceKm / 28) * 60)),
        });
        if (shouldResetRouteFlowRef.current) {
          setIsFareSheetExpanded(true);
          setIsRideSelectionConfirmed(false);
          setIsPaymentSheetExpanded(true);
          setIsPickupConfirmationStep(false);
          setIsPrecisePickupStep(false);
          setIsFindingRide(false);
          setIsDriverFound(false);
          setIsDriverWaiting(false);
          setIsTripInProgress(false);
          setIsTripCompleted(false);
          setIsAwaitingCashConfirmation(false);
          setIsConfirmingCashPayment(false);
          setIsReviewStage(false);
          setIsThankYouStage(false);
        }
        if (!isPrecisePickupStep) {
          mapRef.current?.fitToCoordinates(line, {
            edgePadding: {
              top: 80 + insets.top,
              bottom: 320,
              left: 50,
              right: 50,
            },
            animated: true,
          });
        }
      } finally {
        setIsRouting(false);
      }
    };
    run();
  }, [pickupLocation, destinationLocation, insets.top, isPrecisePickupStep]);

  const resetDestinationFlow = () => {
    setIsDestinationConfirmed(false);
    setIsPickupConfirmationStep(false);
    setIsPrecisePickupStep(false);
    setIsFindingRide(false);
    setIsDriverFound(false);
    setIsDriverWaiting(false);
    setIsTripInProgress(false);
    setIsTripCompleted(false);
    setIsAwaitingCashConfirmation(false);
    setIsConfirmingCashPayment(false);
    setIsReviewStage(false);
    setIsThankYouStage(false);
    setDestinationLocation(null);
    setDestinationLabel("");
    setRouteCoords([]);
    setRouteSummary(null);
    setSelectedRideClass("standard");
    setIsFareSheetExpanded(true);
    setIsRideSelectionConfirmed(false);
    setSelectedPaymentMethodId("cash");
    setIsPaymentSheetExpanded(true);
    setDriverRouteCoords([]);
    setDriverDetails(null);
    setDriverProgress(0);
    setDriverHeading(0);
    setTripProgress(0);
    setTripHeading(0);
    setSelectedRating(0);
    setSelectedReviewTags([]);
    setReviewNote("");
    setSelectedTip(null);
    setCustomTip("");
  };

  const toggleReviewTag = (tag: string) => {
    setSelectedReviewTags(current =>
      current.includes(tag)
        ? current.filter(item => item !== tag)
        : [...current, tag],
    );
  };

  const submitTripReview = () => {
    if (!driverDetails) return;
    if (selectedRating < 1) {
      Alert.alert("Add a rating", "Choose at least one star before submitting.");
      return;
    }

    const parsedTip = Number(customTip);
    const appliedTip =
      selectedTip ?? (Number.isFinite(parsedTip) && parsedTip > 0 ? parsedTip : 0);

    setIsReviewStage(false);
    setIsTripCompleted(false);
    setSelectedTip(appliedTip > 0 ? appliedTip : null);
    setCustomTip(appliedTip > 0 ? String(appliedTip) : "");
    setIsThankYouStage(true);
  };

  const confirmPickup = (coords: LatLng, label: string) => {
    setPickupLocation(coords);
    setPickupLabel(label);
    setPickupText(label);
    setIsEditingPickup(false);
    setActiveField(null);
    setSuggestions([]);

    const tight = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(tight);
    mapRef.current?.animateToRegion(tight, 650);
  };

  const submitPickup = async () => {
    const query = pickupText.trim();
    if (query.length < 3) return;

    const requestId = ++geocodeRequestId.current;
    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (geocodeRequestId.current !== requestId) return;
      if (!results.length) {
        Alert.alert("Pickup not found", "Try a more specific starting address.");
        return;
      }

      const first = results[0];
      const coords = { latitude: first.latitude, longitude: first.longitude };

      try {
        const rev = await Location.reverseGeocodeAsync(coords);
        confirmPickup(coords, toPrettyAddress(rev[0]) || query);
      } catch {
        confirmPickup(coords, query);
      }
    } finally {
      if (geocodeRequestId.current === requestId) setIsGeocoding(false);
    }
  };

  const useCurrentPickupLocation = async () => {
    if (!pickupLocation) return;

    try {
      const rev = await Location.reverseGeocodeAsync(pickupLocation);
      confirmPickup(pickupLocation, toPrettyAddress(rev[0]) || "Current location");
    } catch {
      confirmPickup(pickupLocation, "Current location");
    }
  };

  const confirmDestination = (coords: LatLng, label: string) => {
    setDestinationLocation(coords);
    setDestinationLabel(label);
    setDestinationText(label);
    setIsDestinationConfirmed(true);
    setIsPickupConfirmationStep(false);
    setIsEditingDestination(false);
    setActiveField(null);
    setSuggestions([]);

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

  const handleRegionChangeComplete = (nextRegion: Region) => {
    setRegion(nextRegion);

    if (isPrecisePickupStep) {
      setPickupLocation({
        latitude: nextRegion.latitude,
        longitude: nextRegion.longitude,
      });
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
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        zoomEnabled
        scrollEnabled
        rotateEnabled
        pitchEnabled
        customMapStyle={mapStyle}
      >
        {routeCoords.length >= 2 && !isPrecisePickupStep && !isDriverFound && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={6}
            strokeColor="#2563EB"
          />
        )}

        {isFindingRide && pulseRouteCoords.length >= 2 && (
          <Polyline
            coordinates={pulseRouteCoords}
            strokeWidth={8}
            strokeColor="#7DD3FC"
            lineCap="round"
            lineJoin="round"
          />
        )}

        {pickupLocation && !isPrecisePickupStep && (
          <Marker
            coordinate={pickupLocation}
            pinColor="#132137"
          />
        )}

        {destinationLocation && !isPrecisePickupStep && (
          <Marker coordinate={destinationLocation} pinColor="#E11D48" />
        )}

        {isFindingRide && pulseMarkerPoint && (
          <Marker coordinate={pulseMarkerPoint} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.routePulseMarker}>
              <View style={styles.routePulseOuter} />
              <View style={styles.routePulseInner} />
            </View>
          </Marker>
        )}

        {isDriverFound && driverRouteCoords.length >= 2 && (
          <Polyline
            coordinates={driverRouteCoords}
            strokeWidth={5}
            strokeColor="#22C55E"
            lineDashPattern={[10, 8]}
          />
        )}

        {isDriverFound && driverMarkerPoint && (
          <Marker coordinate={driverMarkerPoint} anchor={{ x: 0.5, y: 0.62 }}>
            <View style={styles.driverMarkerWrap}>
              <View style={styles.driverMarkerShadow} />
              <Image
                source={selectedRide?.image}
                style={[
                  styles.driverMarkerImage,
                  { transform: [{ rotate: `${driverHeading}deg` }] },
                ]}
                resizeMode="contain"
              />
            </View>
          </Marker>
        )}

        {isDriverWaiting && pickupLocation && (
          <Marker coordinate={pickupLocation} anchor={{ x: 0.5, y: 0.62 }}>
            <View style={styles.driverMarkerWrap}>
              <View style={styles.driverMarkerShadow} />
              <Image
                source={selectedRide?.image}
                style={styles.driverMarkerImage}
                resizeMode="contain"
              />
            </View>
          </Marker>
        )}

        {(isTripInProgress || isTripCompleted || isAwaitingCashConfirmation || isReviewStage) &&
          (tripProgress >= 1 ? destinationLocation : tripMarkerPoint) && (
            <Marker
              coordinate={(tripProgress >= 1 ? destinationLocation : tripMarkerPoint) as LatLng}
              anchor={{ x: 0.5, y: 0.62 }}
            >
              <View style={styles.driverMarkerWrap}>
                <View style={styles.driverMarkerShadow} />
                <Image
                  source={selectedRide?.image}
                  style={[
                    styles.driverMarkerImage,
                    { transform: [{ rotate: `${tripHeading}deg` }] },
                  ]}
                  resizeMode="contain"
                />
              </View>
            </Marker>
          )}
      </MapView>

      {isPrecisePickupStep && (
        <View pointerEvents="none" style={styles.centerPinWrap}>
          <View style={styles.centerPinShadow} />
          <MaterialIcons name="place" size={42} color="#132137" />
        </View>
      )}

      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        {showPlanningUi && !hasDestinationText && (
          <View style={styles.header}>
            <Text style={[styles.h1, { color: colors.text }]}>Where are you going?</Text>
            <Text style={[styles.h2, { color: colors.muted }]}>Type an address to get started.</Text>
          </View>
        )}

        {showPlanningUi && (
          <BlurView intensity={48} tint={isDark ? "dark" : "light"} style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardGlassBorder} />

            <View style={styles.inputRow}>
              <MaterialIcons name="my-location" size={18} color={colors.text} />
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.cardSolid, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Current location"
                placeholderTextColor={colors.muted}
                value={pickupText}
                onChangeText={text => {
                  setPickupText(text);
                  setActiveField("pickup");
                }}
                onFocus={() => {
                  setIsEditingPickup(true);
                  setActiveField("pickup");
                }}
                onBlur={() => setIsEditingPickup(false)}
                onSubmitEditing={submitPickup}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.iconBtn,
                  { borderColor: colors.border, backgroundColor: colors.cardSolid },
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                onPress={useCurrentPickupLocation}
                accessibilityRole="button"
                accessibilityLabel="Use current location"
              >
                <MaterialIcons name="gps-fixed" size={20} color={colors.text} />
              </Pressable>
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
                  setActiveField("destination");
                }}
                onFocus={() => {
                  setIsEditingDestination(true);
                  setActiveField("destination");
                }}
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
                    setSuggestions([]);
                    setActiveField(null);
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

            {!hasDestinationText && !hasPickupText && (
              <Text style={styles.helper}>
                Example: &quot;Sandton City&quot; or &quot;12 Main Rd, Cape Town&quot;
              </Text>
            )}
          </BlurView>
        )}

        {showPlanningUi && showSuggestions && (
          <BlurView intensity={48} tint={isDark ? "dark" : "light"} style={[styles.suggestionsCard, { backgroundColor: colors.card }]}>
            <View style={styles.cardGlassBorder} />

            {suggestions.map(item => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => {
                  if (activeField === "pickup") {
                    confirmPickup(item, item.label);
                    return;
                  }
                  confirmDestination(item, item.label);
                }}
              >
                <MaterialIcons
                  name={activeField === "pickup" ? "my-location" : "location-on"}
                  size={18}
                  color={activeField === "pickup" ? colors.text : colors.danger}
                />
                <Text
                  style={[styles.suggestionText, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}

            {!suggestions.length && (
              <View style={styles.suggestionEmpty}>
                <Text style={[styles.suggestionEmptyText, { color: colors.muted }]}>
                  {isGeocoding ? "Searching..." : "No matches yet. Keep typing."}
                </Text>
              </View>
            )}
          </BlurView>
        )}

        {showPlanningUi && !!selectedRide && routeCoords.length >= 2 && (
          <View style={styles.bottomSheets}>
            <BlurView
              intensity={48}
              tint={isDark ? "dark" : "light"}
              style={[styles.fareSheet, { backgroundColor: colors.card }]}
            >
              <View style={styles.cardGlassBorder} />

              <Pressable
                style={styles.fareSheetHeader}
                onPress={() => setIsFareSheetExpanded(value => !value)}
                accessibilityRole="button"
                accessibilityLabel="Toggle ride classes"
              >
                <View style={styles.fareSheetHeaderCopy}>
                  <Text style={[styles.fareTitle, { color: colors.text }]}>
                    {isFareSheetExpanded || !selectedRide
                      ? "Ride classes"
                      : selectedRide.title}
                  </Text>
                  <Text style={[styles.fareSubtitle, { color: colors.muted }]}>
                    {isFareSheetExpanded || !selectedRide
                      ? routeSummary
                        ? `${routeSummary.distanceKm.toFixed(1)} km • ${routeSummary.durationMinutes} min route`
                        : "Route ready"
                      : `${selectedRide.carType} • R ${selectedRide.price.toFixed(2)}`}
                  </Text>
                </View>
                <MaterialIcons
                  name={isFareSheetExpanded ? "expand-more" : "chevron-right"}
                  size={24}
                  color={colors.text}
                />
              </Pressable>

              {!isFareSheetExpanded && selectedRide && (
                <View style={styles.fareCollapsedRow}>
                  <View style={styles.fareOptionInfo}>
                    <View style={styles.fareIconStage}>
                      <View style={styles.fareIconShadow} />
                      <View style={styles.fareIconWrap}>
                        <Image
                          source={selectedRide.image}
                          style={styles.fareImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>

                    <View style={styles.fareCopy}>
                      <Text style={[styles.fareOptionTitle, { color: colors.text }]}>
                        {selectedRide.title}
                      </Text>
                      <Text style={[styles.fareOptionMeta, { color: colors.muted }]}>
                        {selectedRide.passengers} passengers • Pickup in {selectedRide.etaMinutes} min
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.farePrice, { color: colors.text }]}>
                    R {selectedRide.price.toFixed(2)}
                  </Text>
                </View>
              )}

              {isFareSheetExpanded && (
                <>
                  <View style={styles.fareList}>
                    {rideOptions.map(option => {
                      const isSelected = option.id === selectedRideClass;
                      return (
                        <Pressable
                          key={option.id}
                          style={({ pressed }) => [
                            styles.fareOption,
                            {
                              backgroundColor: isSelected
                                ? colors.cardSolid
                                : "transparent",
                              borderColor: isSelected
                                ? colors.primary
                                : colors.border,
                              opacity: pressed ? 0.78 : 1,
                            },
                          ]}
                          onPress={() => setSelectedRideClass(option.id)}
                        >
                          <View style={styles.fareOptionMain}>
                            <View style={styles.fareOptionInfo}>
                              <View style={styles.fareIconStage}>
                                <View style={styles.fareIconShadow} />
                                <View style={styles.fareIconWrap}>
                                  <Image
                                    source={option.image}
                                    style={styles.fareImage}
                                    resizeMode="contain"
                                  />
                                </View>
                              </View>

                              <View style={styles.fareCopy}>
                                <Text
                                  style={[styles.fareOptionTitle, { color: colors.text }]}
                                >
                                  {option.title}
                                </Text>
                                <Text
                                  style={[styles.fareOptionMeta, { color: colors.muted }]}
                                >
                                  {option.carType}
                                </Text>
                                <Text
                                  style={[styles.fareOptionMeta, { color: colors.muted }]}
                                >
                                  {option.passengers} passengers • Pickup in {option.etaMinutes} min
                                </Text>
                              </View>
                            </View>
                            <Text
                              style={[styles.farePrice, { color: colors.text }]}
                            >
                              R {option.price.toFixed(2)}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.confirmBtn,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
                    ]}
                    onPress={() => {
                      setIsRideSelectionConfirmed(true);
                      setIsFareSheetExpanded(false);
                      setIsPaymentSheetExpanded(true);
                      setIsPickupConfirmationStep(false);
                      setIsPrecisePickupStep(false);
                      setIsFindingRide(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to pickup confirmation"
                  >
                    <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                      Continue with {selectedRide.title}
                    </Text>
                  </Pressable>
                </>
              )}
            </BlurView>

            {isRideSelectionConfirmed && selectedRide && (
              <BlurView
                intensity={48}
                tint={isDark ? "dark" : "light"}
                style={[styles.paymentSheet, { backgroundColor: colors.card }]}
              >
                <View style={styles.cardGlassBorder} />

                <Pressable
                  style={styles.fareSheetHeader}
                  onPress={() => setIsPaymentSheetExpanded(value => !value)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle payment methods"
                >
                  <View style={styles.fareSheetHeaderCopy}>
                    <Text style={[styles.fareTitle, { color: colors.text }]}>
                      Payment method
                    </Text>
                    <Text style={[styles.fareSubtitle, { color: colors.muted }]}>
                      {selectedPaymentMethod.label} • {selectedPaymentMethod.details}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isPaymentSheetExpanded ? "expand-more" : "chevron-right"}
                    size={24}
                    color={colors.text}
                  />
                </Pressable>

                {!isPaymentSheetExpanded && (
                  <View style={styles.paymentCollapsedRow}>
                    <View
                      style={[
                        styles.paymentBadge,
                        { backgroundColor: `${selectedPaymentMethod.accent}18` },
                      ]}
                    >
                      <MaterialIcons
                        name={
                          selectedPaymentMethod.type === "cash"
                            ? "payments"
                            : "credit-card"
                        }
                        size={20}
                        color={selectedPaymentMethod.accent}
                      />
                    </View>
                    <View style={styles.fareCopy}>
                      <Text style={[styles.fareOptionTitle, { color: colors.text }]}>
                        {selectedPaymentMethod.label}
                      </Text>
                      <Text style={[styles.fareOptionMeta, { color: colors.muted }]}>
                        {selectedPaymentMethod.details}
                      </Text>
                    </View>
                  </View>
                )}

                {isPaymentSheetExpanded && (
                  <>
                    <View style={styles.fareList}>
                      {paymentMethods.map(method => {
                        const isSelected = method.id === selectedPaymentMethodId;
                        return (
                          <Pressable
                            key={method.id}
                            style={({ pressed }) => [
                              styles.fareOption,
                              {
                                backgroundColor: isSelected
                                  ? colors.cardSolid
                                  : "transparent",
                                borderColor: isSelected
                                  ? colors.primary
                                  : colors.border,
                                opacity: pressed ? 0.8 : 1,
                              },
                            ]}
                            onPress={() => setSelectedPaymentMethodId(method.id)}
                          >
                            <View style={styles.paymentRow}>
                              <View
                                style={[
                                  styles.paymentBadge,
                                  { backgroundColor: `${method.accent}18` },
                                ]}
                              >
                                <MaterialIcons
                                  name={
                                    method.type === "cash"
                                      ? "payments"
                                      : "credit-card"
                                  }
                                  size={20}
                                  color={method.accent}
                                />
                              </View>
                              <View style={styles.fareCopy}>
                                <Text
                                  style={[styles.fareOptionTitle, { color: colors.text }]}
                                >
                                  {method.label}
                                </Text>
                                <Text
                                  style={[styles.fareOptionMeta, { color: colors.muted }]}
                                >
                                  {method.details}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Pressable
                    style={({ pressed }) => [
                      styles.confirmBtn,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
                    ]}
                    onPress={() => {
                      setIsPaymentSheetExpanded(false);
                      setIsPickupConfirmationStep(true);
                      setIsPrecisePickupStep(false);
                      setIsFindingRide(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm payment method"
                  >
                      <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                        Use {selectedPaymentMethod.label}
                      </Text>
                    </Pressable>
                  </>
                )}
              </BlurView>
            )}
          </View>
        )}

        {isDestinationConfirmed && isPickupConfirmationStep && selectedRide && (
          <BlurView intensity={48} tint={isDark ? "dark" : "light"} style={[styles.confirmCard, { backgroundColor: colors.card }]}>
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Confirm pickup spot</Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              {selectedRide.title} selected. Drag the pickup pin if needed, then confirm your exact pickup location.
            </Text>
            <Pressable
              style={({ pressed }) => [
                [styles.confirmBtn, { backgroundColor: colors.primary }],
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => {
                if (!pickupLocation || !destinationLocation) return;

                const tight = {
                  latitude: pickupLocation.latitude,
                  longitude: pickupLocation.longitude,
                  latitudeDelta: 0.0035,
                  longitudeDelta: 0.0035,
                };
                setRegion(tight);
                mapRef.current?.animateToRegion(tight, 450);
                setIsPickupConfirmationStep(false);
                setIsPrecisePickupStep(true);
              }}
              disabled={!pickupLocation || !destinationLocation || isRouting}
              accessibilityRole="button"
              accessibilityLabel="Confirm pickup spot"
            >
              <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                {isRouting ? "Calculating route..." : "Choose exact pickup spot"}
              </Text>
            </Pressable>
          </BlurView>
        )}

        {isPrecisePickupStep && selectedRide && (
          <>
            <BlurView
              intensity={44}
              tint={isDark ? "dark" : "light"}
              style={[styles.exactPickupTopCard, { backgroundColor: colors.card }]}
            >
              <View style={styles.cardGlassBorder} />
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                Set exact pickup point
              </Text>
              <Text style={[styles.confirmText, { color: colors.muted }]}>
                Move the map so the pin sits exactly where you want to be picked up.
              </Text>
              <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
                {pickupLabel}
              </Text>
            </BlurView>

            <BlurView
              intensity={44}
              tint={isDark ? "dark" : "light"}
              style={[styles.exactPickupBottomCard, { backgroundColor: colors.card }]}
            >
              <View style={styles.cardGlassBorder} />
              <View style={styles.preciseMetaRow}>
                <Text style={[styles.preciseMetaText, { color: colors.text }]}>
                  {selectedRide.title}
                </Text>
                <Text style={[styles.preciseMetaText, { color: colors.muted }]}>
                  {selectedPaymentMethod.label}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  [styles.confirmBtn, { backgroundColor: colors.primary }],
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={async () => {
                  if (pickupLocation) {
                    try {
                      const rev = await Location.reverseGeocodeAsync(pickupLocation);
                      const line = toPrettyAddress(rev[0]);
                      if (line) {
                        setPickupLabel(line);
                        setPickupText(line);
                      }
                    } catch {
                      // ignore
                    }
                  }
                  setIsPrecisePickupStep(false);
                  setIsFindingRide(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm exact pickup point"
              >
                <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                  Confirm exact pickup point
                </Text>
              </Pressable>
            </BlurView>
          </>
        )}

        {isFindingRide && selectedRide && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.confirmCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Finding your ride
            </Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              Looking for a nearby {selectedRide.title.toLowerCase()} driver for your exact pickup point.
            </Text>
            <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
              Destination: {destinationLabel || destinationText.trim() || "Selected destination"}
            </Text>
            <View style={styles.findingMetaRow}>
              <View style={styles.findingMetaPill}>
                <Text style={[styles.findingMetaValue, { color: colors.text }]}>
                  {selectedRide.title}
                </Text>
              </View>
              <View style={styles.findingMetaPill}>
                <Text style={[styles.findingMetaValue, { color: colors.text }]}>
                  {selectedPaymentMethod.label}
                </Text>
              </View>
            </View>
            <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
              Route locked. You can still adjust the pickup point or cancel the trip request.
            </Text>
            <View style={styles.findingActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.cardSolid,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
                onPress={() => {
                  setIsFindingRide(false);
                  setIsDriverFound(false);
                  setIsPrecisePickupStep(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Modify trip"
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  Modify
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: "rgba(220,38,38,0.28)",
                    backgroundColor: "rgba(220,38,38,0.08)",
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
                onPress={() => {
                  setIsFindingRide(false);
                  resetDestinationFlow();
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel trip"
              >
                <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>
                  Cancel trip
                </Text>
              </Pressable>
            </View>
          </BlurView>
        )}

        {isDriverFound && selectedRide && driverDetails && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.confirmCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Driver found
            </Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              {driverDetails.name} is on the way to your pickup point now.
            </Text>
            <View style={styles.findingMetaRow}>
              <View style={styles.findingMetaPill}>
                <Text style={[styles.findingMetaValue, { color: colors.text }]}>
                  {driverDetails.car}
                </Text>
              </View>
              <View style={styles.findingMetaPill}>
                <Text style={[styles.findingMetaValue, { color: colors.text }]}>
                  {driverDetails.plate}
                </Text>
              </View>
            </View>
            <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
              Rating {driverDetails.rating.toFixed(2)} • ETA {liveDriverEta ?? driverDetails.etaMinutes} min
            </Text>
            <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
              Driver route to your pickup is shown in green and updates as they approach.
            </Text>
            <View style={[styles.driverProfileCard, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}>
              <View style={styles.driverProfileTop}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {driverDetails.name
                      .split(" ")
                      .map(part => part[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.driverProfileCopy}>
                  <Text style={[styles.driverName, { color: colors.text }]}>
                    {driverDetails.name}
                  </Text>
                  <Text style={[styles.driverMeta, { color: colors.muted }]}>
                    {driverDetails.car} • {driverDetails.plate}
                  </Text>
                </View>
                <Image
                  source={selectedRide.image}
                  style={styles.driverProfileCar}
                  resizeMode="contain"
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.driverMessageBox,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/(main)/driver-chat",
                    params: {
                      driverName: driverDetails.name,
                      driverCar: driverDetails.car,
                      driverPlate: driverDetails.plate,
                      driverRating: driverDetails.rating.toFixed(2),
                      rideImage: String(selectedRide.id),
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Message driver"
              >
                <MaterialIcons name="chat-bubble-outline" size={18} color={colors.muted} />
                <Text style={[styles.driverMessagePlaceholder, { color: colors.muted }]}>
                  Message {driverDetails.name.split(" ")[0]}...
                </Text>
              </Pressable>
            </View>
            <View style={styles.findingActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.cardSolid,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
                onPress={() => {
                  setIsDriverFound(false);
                  setIsFindingRide(false);
                  setIsPrecisePickupStep(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Adjust pickup"
              >
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  Adjust pickup
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: "rgba(220,38,38,0.28)",
                    backgroundColor: "rgba(220,38,38,0.08)",
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
                onPress={() => {
                  setIsDriverFound(false);
                  resetDestinationFlow();
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel trip"
              >
                <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>
                  Cancel trip
                </Text>
              </Pressable>
            </View>
          </BlurView>
        )}

        {isDriverWaiting && selectedRide && driverDetails && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.confirmCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Driver waiting at pickup
            </Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              {driverDetails.name} has arrived and marked the pickup as reached. Trip tracking
              starts now.
            </Text>
            <View
              style={[
                styles.driverProfileCard,
                { backgroundColor: colors.cardSolid, borderColor: colors.border },
              ]}
            >
              <View style={styles.driverProfileTop}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {driverDetails.name
                      .split(" ")
                      .map(part => part[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.driverProfileCopy}>
                  <Text style={[styles.driverName, { color: colors.text }]}>
                    {driverDetails.name}
                  </Text>
                  <Text style={[styles.driverMeta, { color: colors.muted }]}>
                    {driverDetails.car} - {driverDetails.plate}
                  </Text>
                </View>
                <Image
                  source={selectedRide.image}
                  style={styles.driverProfileCar}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
              Next: live trip tracking to {destinationLabel || "your destination"}.
            </Text>
          </BlurView>
        )}

        {isTripInProgress && selectedRide && driverDetails && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.confirmCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Trip in progress
            </Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              {driverDetails.name} is driving you to {destinationLabel || "your destination"}.
            </Text>
            <View style={styles.findingMetaRow}>
              <View style={styles.findingMetaPill}>
                <Text style={[styles.findingMetaValue, { color: colors.text }]}>
                  {Math.max(1, Math.ceil((routeSummary?.durationMinutes ?? 4) * (1 - tripProgress)))} min left
                </Text>
              </View>
              <View style={styles.findingMetaPill}>
                <Text style={[styles.findingMetaValue, { color: colors.text }]}>
                  {routeSummary?.distanceKm.toFixed(1) ?? "0.0"} km
                </Text>
              </View>
            </View>
            <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
              Live route is shown until arrival at the destination.
            </Text>
            <View
              style={[
                styles.driverProfileCard,
                { backgroundColor: colors.cardSolid, borderColor: colors.border },
              ]}
            >
              <View style={styles.driverProfileTop}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {driverDetails.name
                      .split(" ")
                      .map(part => part[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.driverProfileCopy}>
                  <Text style={[styles.driverName, { color: colors.text }]}>
                    {driverDetails.name}
                  </Text>
                  <Text style={[styles.driverMeta, { color: colors.muted }]}>
                    Rating {driverDetails.rating.toFixed(2)} - {driverDetails.car}
                  </Text>
                </View>
                <Image
                  source={selectedRide.image}
                  style={styles.driverProfileCar}
                  resizeMode="contain"
                />
              </View>
            </View>
          </BlurView>
        )}

        {isAwaitingCashConfirmation && selectedRide && driverDetails && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.confirmCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Trip complete
            </Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              Pay the driver directly in cash to finish this trip.
            </Text>
            <View style={styles.tripSummaryRow}>
              <Text style={[styles.tripSummaryLabel, { color: colors.muted }]}>Fare amount</Text>
              <Text style={[styles.tripSummaryValue, { color: colors.text }]}>
                R {selectedRide.price.toFixed(2)}
              </Text>
            </View>
            <View
              style={[
                styles.driverProfileCard,
                { backgroundColor: colors.cardSolid, borderColor: colors.border },
              ]}
            >
              <View style={styles.driverProfileTop}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {driverDetails.name
                      .split(" ")
                      .map(part => part[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.driverProfileCopy}>
                  <Text style={[styles.driverName, { color: colors.text }]}>
                    {driverDetails.name}
                  </Text>
                  <Text style={[styles.driverMeta, { color: colors.muted }]}>
                    {driverDetails.car} - {driverDetails.plate}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
              onPress={() => {
                setIsTripCompleted(false);
                setIsConfirmingCashPayment(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Pay driver"
            >
              <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                Pay driver
              </Text>
            </Pressable>
          </BlurView>
        )}

        {isConfirmingCashPayment && selectedRide && driverDetails && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.confirmCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Waiting for driver confirmation
            </Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              We are waiting for {driverDetails.name} to confirm the cash payment on the driver side.
            </Text>
            <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
              Fare: R {selectedRide.price.toFixed(2)}
            </Text>
          </BlurView>
        )}

        {isReviewStage && selectedRide && driverDetails && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.reviewCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.reviewScroll}
            >
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                Rate your trip
              </Text>
              <Text style={[styles.confirmText, { color: colors.muted }]}>
                Trip finished. Rate the driver, add a note if needed, and leave a tip for card payments.
              </Text>

              <View
                style={[
                  styles.driverProfileCard,
                  { backgroundColor: colors.cardSolid, borderColor: colors.border },
                ]}
              >
                <View style={styles.driverProfileTop}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {driverDetails.name
                        .split(" ")
                        .map(part => part[0])
                        .join("")
                        .slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.driverProfileCopy}>
                    <Text style={[styles.driverName, { color: colors.text }]}>
                      {driverDetails.name}
                    </Text>
                    <Text style={[styles.driverMeta, { color: colors.muted }]}>
                      {driverDetails.car} - {driverDetails.plate}
                    </Text>
                    <Text style={[styles.driverMeta, { color: colors.muted }]}>
                      Rating {driverDetails.rating.toFixed(2)}
                    </Text>
                  </View>
                  <Image
                    source={selectedRide.image}
                    style={styles.driverProfileCarLarge}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <View style={styles.ratingRow}>
                {Array.from({ length: 5 }, (_, index) => {
                  const star = index + 1;
                  const active = selectedRating >= star;
                  return (
                    <Pressable
                      key={star}
                      style={({ pressed }) => [
                        styles.starButton,
                        {
                          backgroundColor: active ? "rgba(245,158,11,0.16)" : colors.cardSolid,
                          borderColor: active ? "#F59E0B" : colors.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      onPress={() => setSelectedRating(star)}
                    >
                      <MaterialIcons
                        name={active ? "star" : "star-border"}
                        size={24}
                        color={active ? "#F59E0B" : colors.muted}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Rate driver service
              </Text>
              <View style={styles.reviewTagsWrap}>
                {REVIEW_TAGS.map(tag => {
                  const active = selectedReviewTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={({ pressed }) => [
                        styles.reviewTag,
                        {
                          backgroundColor: active ? colors.primary : colors.cardSolid,
                          borderColor: active ? colors.primary : colors.border,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                      onPress={() => toggleReviewTag(tag)}
                    >
                      <Text
                        style={[
                          styles.reviewTagText,
                          { color: active ? colors.onPrimary : colors.text },
                        ]}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Leave a note
              </Text>
              <TextInput
                style={[
                  styles.reviewInput,
                  {
                    backgroundColor: colors.cardSolid,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Anything else about the ride?"
                placeholderTextColor={colors.muted}
                value={reviewNote}
                onChangeText={setReviewNote}
                multiline
              />

              {!isCashPayment && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>
                    Add a tip
                  </Text>
                  <View style={styles.tipRow}>
                    {TIP_PRESETS.map(amount => {
                      const active = selectedTip === amount;
                      return (
                        <Pressable
                          key={amount}
                          style={({ pressed }) => [
                            styles.tipButton,
                            {
                              backgroundColor: active ? colors.primary : colors.cardSolid,
                              borderColor: active ? colors.primary : colors.border,
                              opacity: pressed ? 0.82 : 1,
                            },
                          ]}
                          onPress={() => {
                            setSelectedTip(amount);
                            setCustomTip("");
                          }}
                        >
                          <Text
                            style={[
                              styles.tipButtonText,
                              { color: active ? colors.onPrimary : colors.text },
                            ]}
                          >
                            R {amount}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    style={[
                      styles.reviewInput,
                      styles.tipInput,
                      {
                        backgroundColor: colors.cardSolid,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Custom tip amount"
                    placeholderTextColor={colors.muted}
                    value={customTip}
                    onChangeText={text => {
                      setCustomTip(text.replace(/[^0-9.]/g, ""));
                      setSelectedTip(null);
                    }}
                    keyboardType="decimal-pad"
                  />
                </>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
                ]}
                onPress={submitTripReview}
                accessibilityRole="button"
                accessibilityLabel="Submit review"
              >
                <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                  Submit review
                </Text>
              </Pressable>
            </ScrollView>
          </BlurView>
        )}

        {isThankYouStage && driverDetails && (
          <BlurView
            intensity={48}
            tint={isDark ? "dark" : "light"}
            style={[styles.confirmCard, { backgroundColor: colors.card }]}
          >
            <View style={styles.cardGlassBorder} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Thank you
            </Text>
            <Text style={[styles.confirmText, { color: colors.muted }]}>
              Your trip with {driverDetails.name} is complete. Returning you to the booking page now.
            </Text>
            {!isCashPayment && selectedTip && (
              <Text style={[styles.findingMetaHint, { color: colors.muted }]}>
                Tip processed: R {selectedTip.toFixed(2)}
              </Text>
            )}
          </BlurView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  centerPinWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -21,
    marginTop: -42,
    alignItems: "center",
    justifyContent: "center",
  },
  centerPinShadow: {
    position: "absolute",
    bottom: 5,
    width: 20,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.22)",
    transform: [{ scaleX: 1.5 }],
  },
  routePulseMarker: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  routePulseOuter: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(125,211,252,0.35)",
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.55)",
  },
  routePulseInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
    borderWidth: 2,
    borderColor: "#0EA5E9",
  },
  driverMarkerWrap: {
    width: 58,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarkerShadow: {
    position: "absolute",
    bottom: 2,
    width: 32,
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.24)",
    transform: [{ scaleX: 1.18 }],
  },
  driverMarkerImage: {
    width: 50,
    height: 28,
  },
  container: { flex: 1, paddingHorizontal: 16 },
  bottomSheets: {
    marginTop: "auto",
    marginBottom: 12,
    gap: 10,
  },
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

  fareSheet: {
    padding: 14,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  paymentSheet: {
    padding: 14,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  fareSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fareSheetHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  fareTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#132137",
  },
  fareSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#5c6270",
  },
  fareList: {
    marginTop: 12,
    gap: 10,
  },
  fareCollapsedRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fareOption: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fareOptionMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fareOptionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  fareIconStage: {
    width: 52,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  fareIconShadow: {
    position: "absolute",
    bottom: 3,
    width: 36,
    height: 9,
    borderRadius: 999,
    transform: [{ scaleX: 1.2 }],
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  fareIconWrap: {
    width: 64,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  fareImage: {
    width: 56,
    height: 34,
    transform: [{ translateY: -1 }],
  },
  fareCopy: {
    flex: 1,
  },
  fareOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#132137",
  },
  fareOptionMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#6a7280",
  },
  farePrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#132137",
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paymentCollapsedRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paymentBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exactPickupTopCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  exactPickupBottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  preciseMetaRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  preciseMetaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  findingMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  findingMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  findingMetaValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  findingMetaHint: {
    marginTop: 10,
    fontSize: 12,
  },
  driverProfileCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  driverProfileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#132137",
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  driverProfileCopy: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "800",
  },
  driverMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  driverProfileCar: {
    width: 58,
    height: 30,
  },
  driverMessageBox: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  driverMessagePlaceholder: {
    fontSize: 13,
    flex: 1,
  },
  findingActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },

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
  reviewCard: {
    marginTop: "auto",
    marginBottom: 12,
    maxHeight: "72%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  reviewScroll: {
    padding: 14,
    paddingBottom: 18,
  },
  ratingRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  starButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: "800",
  },
  reviewTagsWrap: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reviewTag: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  reviewTagText: {
    fontSize: 13,
    fontWeight: "700",
  },
  reviewInput: {
    marginTop: 10,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  tipRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  tipButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tipButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  tipInput: {
    minHeight: 48,
    paddingVertical: 0,
  },
  tripSummaryRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tripSummaryLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  tripSummaryValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  driverProfileCarLarge: {
    width: 74,
    height: 38,
  },
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
