import React from "react";
import {
  DevSettings,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
  stack: string | null;
};

export class CrashBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
    stack: null,
  };

  static getDerivedStateFromError(error: Error) {
    return {
      error,
      stack: error.stack ?? null,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[RideZA crash boundary]", error);
    console.error("[RideZA component stack]", info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>RideZA preview crash</Text>
          <Text style={styles.title}>Something crashed in the app.</Text>
          <Text style={styles.message}>
            The error was logged to the device console. Use adb logcat to collect
            the full crash output from the preview APK.
          </Text>

          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{this.state.error.message}</Text>
            {!!this.state.stack && (
              <Text style={styles.stack}>{this.state.stack}</Text>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.reloadButton,
              { opacity: pressed ? 0.82 : 1 },
            ]}
            onPress={() => DevSettings.reload()}
            accessibilityRole="button"
            accessibilityLabel="Reload app"
          >
            <Text style={styles.reloadText}>Reload app</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0D12",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 48,
    justifyContent: "center",
  },
  label: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },
  message: {
    marginTop: 10,
    color: "#AAB0C0",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  errorBox: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#12141C",
    padding: 14,
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "900",
  },
  stack: {
    marginTop: 10,
    color: "#D1D5DB",
    fontSize: 11,
    lineHeight: 16,
  },
  reloadButton: {
    marginTop: 18,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  reloadText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
