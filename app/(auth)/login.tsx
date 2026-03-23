import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useTheme } from "../../src/theme/ThemeProvider";

const DEFAULT_TEST_ACCOUNT = { email: "test@rideza.com", password: "password123" };

export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isValid = useMemo(() => {
    return /\S+@\S+\.\S+/.test(email) && password.length >= 6;
  }, [email, password]);

  const onSignIn = async () => {
    if (!isValid) {
      Alert.alert(
        "Invalid input",
        "Enter a valid email and a password (min 6 chars).",
      );
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const [storedEmail, storedPassword] = await Promise.all([
        AsyncStorage.getItem("@test_account_email"),
        AsyncStorage.getItem("@test_account_password"),
      ]);

      const isDefaultTest =
        normalizedEmail === DEFAULT_TEST_ACCOUNT.email &&
        password === DEFAULT_TEST_ACCOUNT.password;
      const isStoredTest =
        !!storedEmail &&
        !!storedPassword &&
        normalizedEmail === storedEmail &&
        password === storedPassword;

      if (!isDefaultTest && !isStoredTest) {
        throw new Error(
          `Invalid credentials. Use ${DEFAULT_TEST_ACCOUNT.email} / ${DEFAULT_TEST_ACCOUNT.password} for testing.`,
        );
      }

      const token = "fake-jwt-token";

      await AsyncStorage.multiSet([
        ["@user_token", token],
        ["hasOnboarded", "true"],
      ]);

      router.replace("/(main)");
    } catch (err: any) {
      Alert.alert("Sign in failed", err?.message || "Please try again.");
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
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {__DEV__ && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Test account: {DEFAULT_TEST_ACCOUNT.email} / {DEFAULT_TEST_ACCOUNT.password}
            </Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, !isValid || loading ? styles.buttonDisabled : null]}
          onPress={onSignIn}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/signup")}
            disabled={loading}
          >
            <Text style={styles.link}>Create account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
            disabled={loading}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
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
      marginBottom: 16,
      textAlign: "center",
    },
    hint: {
      marginBottom: 14,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.cardSolid,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hintText: { color: colors.muted, fontSize: 12, textAlign: "center" },
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
    buttonDisabled: { backgroundColor: "rgba(37,99,235,0.45)" },
    buttonText: { color: colors.onPrimary, fontWeight: "800" },
    row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    link: { color: colors.primary, fontWeight: "700" },
  });
}
