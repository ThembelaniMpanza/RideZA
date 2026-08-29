import { router } from "expo-router";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, isFirebaseConfigured } from "../../src/services/firebase";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const normalizedEmail = email.trim().toLowerCase();
  const isValidEmail = /\S+@\S+\.\S+/.test(normalizedEmail);

  const showSuccess = () => {
    Alert.alert(
      "Check your email",
      "If an account exists for that address, Firebase has sent password reset instructions.",
      [{ text: "OK", onPress: () => router.back() }],
    );
  };

  const onSend = async () => {
    if (!isFirebaseConfigured()) {
      Alert.alert(
        "Firebase not configured",
        "Set the EXPO_PUBLIC_FIREBASE_* environment variables before resetting passwords.",
      );
      return;
    }

    if (!isValidEmail) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      showSuccess();
    } catch (error: unknown) {
      if (error instanceof FirebaseError && error.code === "auth/user-not-found") {
        showSuccess();
        return;
      }

      const message =
        error instanceof FirebaseError && error.code === "auth/too-many-requests"
          ? "Too many reset attempts. Wait a few minutes and try again."
          : error instanceof FirebaseError &&
              error.code === "auth/network-request-failed"
            ? "Check your internet connection and try again."
            : "We could not send the reset email. Please try again.";

      Alert.alert("Reset failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we will send a reset link.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => void onSend()}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading ? styles.buttonDisabled : null]}
          onPress={() => void onSend()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.link}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { padding: 24, flex: 1, justifyContent: "center" },
    title: {
      fontSize: 28,
      fontWeight: "700",
      marginBottom: 6,
      textAlign: "center",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      marginBottom: 24,
      textAlign: "center",
    },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
      color: colors.text,
      backgroundColor: colors.cardSolid,
    },
    button: {
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.onPrimary, fontWeight: "800" },
    back: { marginTop: 16, alignItems: "center" },
    link: { color: colors.primary, fontWeight: "700" },
  });
}
