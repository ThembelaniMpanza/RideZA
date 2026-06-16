import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import type { ThemeColors } from "../../src/theme/theme";

const REQUIRED_TRUST_SCORE = 85;
const USER_TRUST_SCORE = 72;

const BENEFITS = [
  "Ride now, pay later",
  "Priority support",
  "Higher ride availability",
  "Monthly statements",
  "Emergency transport access",
  "Potential discounts",
  "Take rides on credit",
  "Repay automatically via debit order",
];

const RESPONSIBILITIES = [
  "Monthly repayment obligation",
  "Debit order agreement",
  "Credit checks",
  "Late payment penalties",
  "Account suspension on non-payment",
];

const SIMILAR_MODELS = [
  "Buy Now Pay Later",
  "Corporate travel accounts",
  "Uber business monthly invoicing",
  "Small personal transport credit line",
];

const ELIGIBILITY_RULES = [
  "Completed at least 100 successful rides",
  "Low cancellation rate",
  "No fraud history",
  "Good payment history",
  "Verified identity",
  "Active account for at least 3 to 6 months",
  "Verified phone number and email",
  "Pass affordability and credit checks",
];

export default function RidezaPlusScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isEligible = USER_TRUST_SCORE >= REQUIRED_TRUST_SCORE;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 28 },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to account"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>RideZA+</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="workspace-premium" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>VIP Membership</Text>
          <Text style={styles.subtitle}>
            RideZA+ is for trusted riders who qualify for monthly transport credit,
            debit order repayment, and premium ride benefits.
          </Text>

          <View style={styles.scoreCard}>
            <View style={styles.scoreTopRow}>
              <Text style={styles.scoreLabel}>Trust score</Text>
              <Text style={styles.scoreValue}>{USER_TRUST_SCORE}/100</Text>
            </View>
            <View style={styles.scoreTrack}>
              <View
                style={[
                  styles.scoreFill,
                  { width: `${USER_TRUST_SCORE}%` },
                  isEligible ? styles.scoreFillEligible : null,
                ]}
              />
            </View>
            <Text style={styles.scoreHint}>
              Required score: {REQUIRED_TRUST_SCORE}/100
            </Text>
          </View>
        </View>

        <InfoSection
          title="Benefits"
          items={BENEFITS}
          icon="add-card"
          styles={styles}
          colors={colors}
        />

        <InfoSection
          title="Responsibilities"
          items={RESPONSIBILITIES}
          icon="assignment"
          styles={styles}
          colors={colors}
        />

        <InfoSection
          title="Similar to"
          items={SIMILAR_MODELS}
          icon="business-center"
          styles={styles}
          colors={colors}
        />

        <View style={styles.warningCard}>
          <MaterialIcons name="verified-user" size={22} color="#D97706" />
          <View style={styles.warningCopy}>
            <Text style={styles.warningTitle}>Eligibility protects the business</Text>
            <Text style={styles.warningText}>
              RideZA+ is only available after strong trust, payment, identity,
              and affordability checks.
            </Text>
          </View>
        </View>

        <InfoSection
          title="Eligibility rules"
          items={ELIGIBILITY_RULES}
          icon="check-circle-outline"
          styles={styles}
          colors={colors}
        />

        <Pressable
          style={({ pressed }) => [
            styles.termsButton,
            { opacity: pressed ? 0.78 : 1 },
          ]}
          onPress={() => router.push("/(main)/help-support")}
          accessibilityRole="button"
          accessibilityLabel="View RideZA plus terms and conditions"
        >
          <MaterialIcons name="description" size={20} color={colors.primary} />
          <Text style={styles.termsText}>Terms and conditions</Text>
          <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.applyButton,
              !isEligible && styles.applyButtonDisabled,
              { opacity: pressed && isEligible ? 0.84 : 1 },
            ]}
            disabled={!isEligible}
            onPress={() => {
              Alert.alert(
                "Application started",
                "Your RideZA+ application will continue with affordability and credit checks.",
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Apply for RideZA plus"
          >
            <Text
              style={[
                styles.applyButtonText,
                !isEligible && styles.applyButtonTextDisabled,
              ]}
            >
              {isEligible ? "Become VIP" : "Apply locked"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel RideZA plus"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>

        {!isEligible && (
          <Text style={styles.lockedReason}>
            Complete more successful rides and maintain a strong payment record to unlock applications.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function InfoSection({
  title,
  items,
  icon,
  styles,
  colors,
}: {
  title: string;
  items: string[];
  icon: keyof typeof MaterialIcons.glyphMap;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <MaterialIcons name={icon} size={19} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.list}>
        {items.map(item => (
          <View key={item} style={styles.listItem}>
            <View style={styles.listDot} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    topBar: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSolid,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backButtonPlaceholder: {
      width: 42,
      height: 42,
    },
    topBarTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },
    heroCard: {
      marginTop: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      padding: 16,
    },
    heroIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37,99,235,0.11)",
    },
    title: {
      marginTop: 16,
      fontSize: 28,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "600",
      color: colors.muted,
    },
    scoreCard: {
      marginTop: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      backgroundColor: colors.background,
    },
    scoreTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    scoreLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },
    scoreValue: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
    },
    scoreTrack: {
      marginTop: 10,
      height: 9,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: colors.border,
    },
    scoreFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: "#D97706",
    },
    scoreFillEligible: {
      backgroundColor: "#16A34A",
    },
    scoreHint: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: "700",
      color: colors.muted,
    },
    sectionCard: {
      marginTop: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      padding: 14,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37,99,235,0.1)",
    },
    sectionTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
    },
    list: {
      marginTop: 12,
      gap: 9,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
    },
    listDot: {
      width: 6,
      height: 6,
      marginTop: 7,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    listText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
      color: colors.muted,
    },
    warningCard: {
      marginTop: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(217,119,6,0.28)",
      backgroundColor: "rgba(217,119,6,0.1)",
      padding: 14,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    warningCopy: {
      flex: 1,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
    },
    warningText: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
      color: colors.muted,
    },
    termsButton: {
      marginTop: 14,
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    termsText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
    },
    actions: {
      marginTop: 18,
      gap: 10,
    },
    applyButton: {
      height: 50,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    applyButtonDisabled: {
      backgroundColor: "rgba(148,163,184,0.35)",
    },
    applyButtonText: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.onPrimary,
    },
    applyButtonTextDisabled: {
      color: colors.muted,
    },
    cancelButton: {
      height: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSolid,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
    },
    lockedReason: {
      marginTop: 12,
      textAlign: "center",
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: colors.muted,
    },
  });
}
