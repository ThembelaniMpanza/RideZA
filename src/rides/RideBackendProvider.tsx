import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useRealtime, type RealtimeEvent } from "../realtime/RealtimeProvider";
import {
  riderApi,
  type FareEstimate,
  type GeoPoint,
  type TripMessage,
  type TripState,
} from "../services/backendApi";

export type RideBookingInput = {
  pickup: GeoPoint;
  pickupLabel: string;
  destination: GeoPoint;
  destinationLabel: string;
  distanceKm: number;
  durationMinutes: number;
  farePlanCode?: string;
};

type RideBackendContextValue = {
  activeTrip: TripState | null;
  estimate: FareEstimate | null;
  messages: TripMessage[];
  isBusy: boolean;
  error: string | null;
  requestRide: (input: RideBookingInput) => Promise<TripState>;
  refreshActiveTrip: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  cancelActiveTrip: (reason?: string) => Promise<void>;
  clearActiveTrip: () => Promise<void>;
};

const RideBackendContext = createContext<RideBackendContextValue | null>(null);

export function RideBackendProvider({ children }: { children: React.ReactNode }) {
  const { user, verifiedSession } = useAuth();
  const realtime = useRealtime();
  const [activeTrip, setActiveTrip] = useState<TripState | null>(null);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshActiveTrip = useCallback(async () => {
    if (!activeTrip) return;
    const [state, nextMessages] = await Promise.all([
      riderApi.tripState(activeTrip.id),
      activeTrip.driverId ? riderApi.messages(activeTrip.id) : Promise.resolve([]),
    ]);
    setActiveTrip(state);
    setMessages(nextMessages);
  }, [activeTrip]);

  useEffect(() => realtime.subscribe((event: RealtimeEvent) => {
    const payload = event.payload as { tripId?: string };
    if (!activeTrip || payload.tripId !== activeTrip.id) return;
    if (event.type === "trip.status-changed.v1" || event.type === "ride.driver-matched.v1") {
      void refreshActiveTrip().catch(() => undefined);
    }
    if (event.type === "trip.message-sent.v1") {
      void riderApi.messages(activeTrip.id).then(setMessages).catch(() => undefined);
    }
  }), [activeTrip, realtime, refreshActiveTrip]);

  useEffect(() => {
    if (!user) {
      setActiveTrip(null);
      setEstimate(null);
      setMessages([]);
      setError(null);
    }
  }, [user]);

  const requestRide = useCallback(async (input: RideBookingInput) => {
    if (!verifiedSession) throw new Error("The backend session is not verified yet.");
    setIsBusy(true);
    setError(null);
    try {
      const farePlanCode = input.farePlanCode ?? "STANDARD";
      const [plans, fareEstimate] = await Promise.all([
        riderApi.farePlans(),
        riderApi.estimateFare({
          distanceKm: input.distanceKm,
          durationMinutes: input.durationMinutes,
          farePlanCode,
        }),
      ]);
      const plan = plans.find(item => item.code.toUpperCase() === farePlanCode.toUpperCase() && item.isActive);
      if (!plan) throw new Error(`The ${farePlanCode} fare plan is unavailable.`);

      const created = await riderApi.requestTrip({
        farePlanId: plan.id,
        pickup: input.pickup,
        pickupLabel: input.pickupLabel,
        destination: input.destination,
        destinationLabel: input.destinationLabel,
        estimatedDistanceKm: input.distanceKm,
        estimatedDurationMinutes: input.durationMinutes,
        currency: fareEstimate.currency,
      });
      const state = await riderApi.tripState(created.id);
      setEstimate(fareEstimate);
      setActiveTrip(state);
      setMessages([]);
      await realtime.subscribeToTrip(state.id).catch(() => undefined);
      return state;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not request the ride.";
      setError(message);
      throw requestError;
    } finally {
      setIsBusy(false);
    }
  }, [realtime, verifiedSession]);

  const sendMessage = useCallback(async (message: string) => {
    if (!activeTrip) throw new Error("There is no active trip.");
    const sent = await riderApi.sendMessage(activeTrip.id, message);
    setMessages(current => current.some(item => item.id === sent.id) ? current : [...current, sent]);
  }, [activeTrip]);

  const clearActiveTrip = useCallback(async () => {
    if (activeTrip) await realtime.unsubscribeFromTrip(activeTrip.id).catch(() => undefined);
    setActiveTrip(null);
    setEstimate(null);
    setMessages([]);
    setError(null);
  }, [activeTrip, realtime]);

  const cancelActiveTrip = useCallback(async (reason?: string) => {
    if (!activeTrip) throw new Error("There is no active trip.");
    const cancelled = await riderApi.cancelTrip(activeTrip.id, reason);
    setActiveTrip(cancelled);
    await realtime.unsubscribeFromTrip(activeTrip.id).catch(() => undefined);
  }, [activeTrip, realtime]);

  const value = useMemo(() => ({
    activeTrip,
    estimate,
    messages,
    isBusy,
    error,
    requestRide,
    refreshActiveTrip,
    sendMessage,
    cancelActiveTrip,
    clearActiveTrip,
  }), [activeTrip, cancelActiveTrip, clearActiveTrip, error, estimate, isBusy, messages, refreshActiveTrip, requestRide, sendMessage]);

  return <RideBackendContext.Provider value={value}>{children}</RideBackendContext.Provider>;
}

export function useRideBackend() {
  const value = useContext(RideBackendContext);
  if (!value) throw new Error("useRideBackend must be used within RideBackendProvider");
  return value;
}
