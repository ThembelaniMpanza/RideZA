import * as signalR from "@microsoft/signalr";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { getBackendBaseUrl } from "../services/backendApi";
import { auth } from "../services/firebase";

export type RealtimeEvent<TPayload = Record<string, unknown>> = {
  eventId: string;
  occurredAtUtc: string;
  type:
    | "ride.requested.v1"
    | "ride.driver-matched.v1"
    | "trip.status-changed.v1"
    | "trip.completed.v1"
    | "driver.location-updated.v1"
    | "ride.offer-created.v1"
    | "ride.offer-status-changed.v1"
    | "trip.message-sent.v1";
  payload: TPayload;
};

export type TripSubscriptionSnapshot = {
  tripId: string;
  status: string;
  updatedAtUtc: string;
};

type ConnectionStatus = "disabled" | "connecting" | "connected" | "reconnecting" | "disconnected";
type EventListener = (event: RealtimeEvent) => void;

type RealtimeContextValue = {
  status: ConnectionStatus;
  lastEvent: RealtimeEvent | null;
  subscribe: (listener: EventListener) => () => void;
  subscribeToTrip: (tripId: string) => Promise<TripSubscriptionSnapshot>;
  unsubscribeFromTrip: (tripId: string) => Promise<void>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const MAX_SEEN_EVENT_IDS = 256;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>("disabled");
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const activeTripId = useRef<string | null>(null);
  const listeners = useRef(new Set<EventListener>());
  const seenEventIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user || !process.env.EXPO_PUBLIC_API_URL?.trim()) {
      setStatus("disabled");
      return;
    }

    let disposed = false;
    const seenIds = seenEventIds.current;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${getBackendBaseUrl()}/hubs/realtime`, {
        accessTokenFactory: async () => {
          const currentUser = auth.currentUser;
          if (!currentUser) throw new Error("The Firebase session ended.");
          return currentUser.getIdToken();
        },
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;
    connection.on("realtimeEvent", (event: RealtimeEvent) => {
      if (!event?.eventId || seenIds.has(event.eventId)) return;
      seenIds.add(event.eventId);
      if (seenIds.size > MAX_SEEN_EVENT_IDS) {
        const oldest = seenIds.values().next().value;
        if (oldest) seenIds.delete(oldest);
      }
      setLastEvent(event);
      listeners.current.forEach(listener => listener(event));
    });
    connection.onreconnecting(() => setStatus("reconnecting"));
    connection.onreconnected(async () => {
      setStatus("connected");
      if (activeTripId.current) {
        await connection.invoke("SubscribeToTrip", activeTripId.current).catch(() => undefined);
      }
    });
    connection.onclose(() => {
      if (!disposed) setStatus("disconnected");
    });

    setStatus("connecting");
    connection.start()
      .then(() => {
        if (!disposed) setStatus("connected");
      })
      .catch(() => {
        if (!disposed) setStatus("disconnected");
      });

    return () => {
      disposed = true;
      connectionRef.current = null;
      activeTripId.current = null;
      seenIds.clear();
      void connection.stop();
    };
  }, [user]);

  const subscribe = useCallback((listener: EventListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const subscribeToTrip = useCallback(async (tripId: string) => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error("Realtime connection is not ready.");
    }
    const snapshot = await connection.invoke<TripSubscriptionSnapshot>("SubscribeToTrip", tripId);
    activeTripId.current = tripId;
    return snapshot;
  }, []);

  const unsubscribeFromTrip = useCallback(async (tripId: string) => {
    const connection = connectionRef.current;
    if (activeTripId.current === tripId) activeTripId.current = null;
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("UnsubscribeFromTrip", tripId);
    }
  }, []);

  const value = useMemo(() => ({
    status,
    lastEvent,
    subscribe,
    subscribeToTrip,
    unsubscribeFromTrip,
  }), [lastEvent, status, subscribe, subscribeToTrip, unsubscribeFromTrip]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used within RealtimeProvider");
  return value;
}
