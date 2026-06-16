import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import type { ThemeColors } from "../../src/theme/theme";

type TermsStep = {
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: string[];
};

const TERMS_STEPS: TermsStep[] = [
  {
    title: "Step 1 - Become VIP",
    description: "The VIP page explains the membership before the user applies.",
    icon: "workspace-premium",
    items: [
      "Ride now, pay later",
      "Priority support",
      "Higher ride availability",
      "Monthly statements",
      "Emergency transport access",
      "Potential discounts",
      "Monthly repayment obligation",
      "Debit order agreement",
      "Credit checks",
      "Late payment penalties",
      "Account suspension on non-payment",
    ],
  },
  {
    title: "Step 2 - Identity Verification",
    description: "KYC protects the platform before any credit access is granted.",
    icon: "badge",
    items: [
      "Full names",
      "South African ID number",
      "Selfie verification",
      "Proof of address",
      "Phone number verification",
      "Email verification",
      "Possible Home Affairs verification",
      "Possible face matching",
      "Possible fraud detection",
    ],
  },
  {
    title: "Step 3 - Financial Information",
    description: "Financial details are used for affordability and debit order setup.",
    icon: "account-balance",
    items: [
      "Employer",
      "Salary range",
      "Employment type",
      "Payday date",
      "Bank name",
      "Account number",
      "Account type",
      "Branch code",
      "Account holder confirmation",
    ],
  },
  {
    title: "Step 4 - Consent & Legal Agreements",
    description: "The user must explicitly accept the legal and payment obligations.",
    icon: "gavel",
    items: [
      "Credit check consent",
      "Debit order authority",
      "Repayment terms",
      "Missed payment process",
      "Collections process",
      "Suspension rules",
      "Dispute handling",
      "Privacy policy",
      "POPIA compliance",
      "National Credit Act compliance",
      "Required checkboxes",
      "Digital signature",
      "OTP verified submission",
    ],
  },
  {
    title: "Step 5 - Credit Assessment Engine",
    description: "Risk control decides whether the application can continue.",
    icon: "fact-check",
    items: [
      "Credit bureau score for debt risk",
      "Existing debt review check",
      "Income estimation for affordability",
      "Ride behavior for platform trust",
      "Fraud checks for identity safety",
      "Bank account verification for payment reliability",
      "Possible outcome: Approved",
      "Possible outcome: Declined",
      "Possible outcome: Manual review",
    ],
  },
];

const CONSENT_EXAMPLES = [
  "I consent to the platform obtaining and processing my credit information for affordability and risk assessment purposes.",
  "I authorize automatic debit orders for amounts due.",
];

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>RideZA+ Terms</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.iconBox}>
            <MaterialIcons name="verified-user" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>VIP application process</Text>
          <Text style={styles.subtitle}>
            RideZA+ is a controlled transport credit feature. These steps protect
            the rider, the driver network, and the business before monthly credit
            is approved.
          </Text>
        </View>

        <View style={styles.warningCard}>
          <MaterialIcons name="priority-high" size={22} color="#D97706" />
          <View style={styles.warningCopy}>
            <Text style={styles.warningTitle}>Consent is required</Text>
            <Text style={styles.warningText}>
              Credit checks, debit order authority, legal terms, digital signature,
              and OTP verification must be completed before submission.
            </Text>
          </View>
        </View>

        {TERMS_STEPS.map(step => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIcon}>
                <MaterialIcons name={step.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>

            <View style={styles.list}>
              {step.items.map(item => (
                <View key={item} style={styles.listItem}>
                  <View style={styles.listDot} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepIcon}>
              <MaterialIcons name="edit-document" size={20} color={colors.primary} />
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>Consent wording examples</Text>
              <Text style={styles.stepDescription}>
                These examples can be used in the application form later.
              </Text>
            </View>
          </View>

          <View style={styles.list}>
            {CONSENT_EXAMPLES.map(item => (
              <View key={item} style={styles.quoteBox}>
                <Text style={styles.quoteText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
    iconBox: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37,99,235,0.11)",
    },
    title: {
      marginTop: 16,
      fontSize: 24,
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
    stepCard: {
      marginTop: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSolid,
      padding: 14,
    },
    stepHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    stepIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(37,99,235,0.1)",
    },
    stepCopy: {
      flex: 1,
      minWidth: 0,
    },
    stepTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
    },
    stepDescription: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: colors.muted,
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
    quoteBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
    },
    quoteText: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "700",
      color: colors.text,
    },
  });
}
