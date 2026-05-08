import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { t } from "../i18n";
import { updateBankBalance } from "../services/api/moneyos";
import { useSessionStore } from "../store/session";
import { theme } from "../theme";

export default function EditBankBalanceScreen() {
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const userId = useSessionStore((state) => state.userId);
  const currentAmount = useSessionStore((state) => state.dashboard.cashflowSummary?.working_bank_balance ?? 0);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const [amount, setAmount] = useState(currentAmount > 0 ? String(Math.round(currentAmount)) : "");
  const [saving, setSaving] = useState(false);

  return (
    <AppScreen title={t(language, "bankConfirmEdit")} subtitle={t(language, "bankConfirmHelper")}>
      <View style={styles.card}>
        <Text style={styles.label}>{t(language, "bankSeen")}</Text>
        <TextInput
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholder="Example: 12000"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.help}>{t(language, "safeZeroCommittedDetail")}</Text>
      </View>

      <Button
        label={saving ? t(language, "saving") : t(language, "saveRefresh")}
        disabled={saving || !amount.trim()}
        onPress={async () => {
          if (!userId) {
            Alert.alert("Missing session", "Please go back and reload the app.");
            return;
          }
          const numericAmount = Number(amount);
          if (!Number.isFinite(numericAmount) || numericAmount < 0) {
            Alert.alert("Enter a valid amount", "Please enter your current bank / savings amount.");
            return;
          }
          setSaving(true);
          try {
            await updateBankBalance(userId, numericAmount, "manual");
            await refreshDashboard();
            router.back();
          } catch (error) {
            Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
          } finally {
            setSaving(false);
          }
        }}
      />

      <Button label={t(language, "backHome")} variant="secondary" onPress={() => router.back()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: "600",
    color: theme.colors.text
  },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.white
  },
  help: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    lineHeight: 18
  }
});
