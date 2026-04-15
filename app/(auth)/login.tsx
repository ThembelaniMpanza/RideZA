import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
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
import { auth, isFirebaseConfigured } from "@/src/services/firebase";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isValid = useMemo(() => {
    return /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6;
  }, [email, password]);

  const onSignIn = async () => {
    if (!isFirebaseConfigured()) {
      Alert.alert(
        "Firebase not configured",
        "Set the EXPO_PUBLIC_FIREBASE_* environment variables before signing in.",
      );
      return;
    }

    if (!isValid) {
      Alert.alert(
        "Invalid input",
        "Enter a valid email and a password with at least 6 characters.",
      );
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
      const token = await credential.user.getIdToken();

      await AsyncStorage.multiSet([
        ["@user_token", token],
        ["@user_email", normalizedEmail],
        ["@firebase_uid", credential.user.uid],
        ["hasOnboarded", "true"],
      ]);

      router.replace("/(main)");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Please try again.";
      Alert.alert("Sign in failed", message);
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
        <Text style={styles.subtitle}>Sign in with your Firebase account</Text>

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
    buttonDisabled: { backgroundColor: "rgba(37,99,235,0.45)" },
    buttonText: { color: colors.onPrimary, fontWeight: "800" },
    row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    link: { color: colors.primary, fontWeight: "700" },
  });
}
