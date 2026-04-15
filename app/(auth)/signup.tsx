import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

export default function SignupScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isValid = useMemo(() => {
    const emailOk = /\S+@\S+\.\S+/.test(email);
    const pwOk = password.length >= 6;
    const confirmOk = confirmPassword === password && confirmPassword.length > 0;
    return emailOk && pwOk && confirmOk;
  }, [email, password, confirmPassword]);

  const onSignUp = async () => {
    if (!isFirebaseConfigured()) {
      Alert.alert(
        "Firebase not configured",
        "Set the EXPO_PUBLIC_FIREBASE_* environment variables before creating accounts.",
      );
      return;
    }

    if (!isValid) {
      Alert.alert(
        "Invalid input",
        "Enter a valid email and matching passwords (min 6 chars).",
      );
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const credential = await createUserWithEmailAndPassword(
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
      Alert.alert("Sign up failed", message);
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Create a Firebase account to continue</Text>

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
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, !isValid || loading ? styles.buttonDisabled : null]}
          onPress={onSignUp}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.muted}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            disabled={loading}
          >
            <Text style={styles.link}>Login</Text>
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
    muted: { color: colors.muted },
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
    row: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 12,
      gap: 8,
    },
    link: { color: colors.primary, fontWeight: "700" },
  });
}
