import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";

type ChatMessage = {
  id: string;
  author: "driver" | "passenger";
  text: string;
};

export default function DriverChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    driverName?: string;
    driverCar?: string;
    driverPlate?: string;
    driverRating?: string;
    rideImage?: string;
  }>();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "driver-1",
      author: "driver",
      text: "Hi, I’m on the way to your pickup point.",
    },
    {
      id: "driver-2",
      author: "driver",
      text: "If you’re at a gate or entrance, send me a quick note.",
    },
  ]);

  const driverName = params.driverName ?? "Driver";
  const driverMeta = `${params.driverCar ?? "Vehicle"} • ${params.driverPlate ?? "Plate unavailable"}`;
  const canSend = draft.trim().length > 0;

  const bubbleStyles = useMemo(
    () =>
      StyleSheet.create({
        passenger: {
          alignSelf: "flex-end",
          backgroundColor: colors.primary,
        },
        driver: {
          alignSelf: "flex-start",
          backgroundColor: colors.cardSolid,
          borderWidth: 1,
          borderColor: colors.border,
        },
      }),
    [colors],
  );

  const sendMessage = () => {
    if (!canSend) return;

    const next = draft.trim();
    setMessages(current => [
      ...current,
      { id: `passenger-${Date.now()}`, author: "passenger", text: next },
    ]);
    setDraft("");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.background }]}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.driverName, { color: colors.text }]}>{driverName}</Text>
          <Text style={[styles.driverMeta, { color: colors.muted }]}>{driverMeta}</Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(main)/driver-call",
              params: {
                driverName,
                driverCar: params.driverCar,
                driverPlate: params.driverPlate,
              },
            })
          }
          style={[styles.headerBtn, { backgroundColor: colors.cardSolid, borderColor: colors.border }]}
        >
          <MaterialIcons name="call" size={18} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.author === "passenger" ? bubbleStyles.passenger : bubbleStyles.driver,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: message.author === "passenger" ? colors.onPrimary : colors.text },
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={`Message ${driverName.split(" ")[0]}...`}
          placeholderTextColor={colors.muted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? colors.primary : "rgba(37,99,235,0.45)" },
          ]}
          onPress={sendMessage}
          disabled={!canSend}
        >
          <MaterialIcons name="north" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  headerCopy: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "800",
  },
  driverMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  messages: {
    paddingVertical: 18,
    gap: 10,
  },
  messageBubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  composer: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
