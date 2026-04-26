import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { trackingScopeOptions } from "../../features/onboarding/options";
import { loadSampleStatement } from "../../services/api/moneyos";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

function selectedPersona(userType: string | null) {
  switch (userType) {
    case "salaried":
      return {
        emoji: "💼",
        title: "Salaried",
        subtitle: "Monthly salary, office work, regular bills"
      };
    case "daily_wage":
      return {
        emoji: "🛠️",
        title: "Daily Wage",
        subtitle: "Construction, driving, labor, or daily cash work"
      };
    case "farmer_seasonal":
      return {
        emoji: "🌾",
        title: "Farmer / Seasonal",
        subtitle: "Harvest money, seasonal sales, or income in waves"
      };
    case "business_self_employed":
      return {
        emoji: "🏪",
        title: "Business / Self-Employed",
        subtitle: "Shop, service work, freelancing, or mixed money"
      };
    case "family_manager":
      return {
        emoji: "🏠",
        title: "Family Manager",
        subtitle: "Keeping household money visible in one place"
      };
    default:
      return null;
  }
}

export default function OnboardingCompleteScreen() {
  const draft = useSessionStore((state) => state.onboardingDraft);
  const setDraft = useSessionStore((state) => state.setDraft);
  const saveOnboarding = useSessionStore((state) => state.saveOnboarding);
  const userId = useSessionStore((state) => state.userId);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const saving = useSessionStore((state) => state.savingOnboarding);
  const persona = useMemo(() => selectedPersona(draft.userType), [draft.userType]);

  const needsSalaryDay = useMemo(() => draft.incomePattern === "monthly", [draft.incomePattern]);
  const needsScope = useMemo(
    () => draft.userType === "business_self_employed" || draft.userType === "family_manager",
    [draft.userType]
  );
  const monthlyMoneyLabel = useMemo(() => {
    if (draft.userType === "salaried") {
      return "When does salary usually come?";
    }
    if (draft.userType === "family_manager") {
      return "When does the main monthly money usually come?";
    }
    return "When does monthly money usually come in?";
  }, [draft.userType]);
  const monthlyMoneyPlaceholder = useMemo(() => {
    if (draft.userType === "salaried") {
      return "Example: 1 for salary on the 1st";
    }
    return "Example: 5";
  }, [draft.userType]);

  return (
    <AppScreen title="One last step" subtitle="Save your setup, then we will load a sample statement so you can see the app work right away.">
      {persona ? (
        <View style={[commonStyles.card, commonStyles.shadow, styles.personaCard]}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarEmoji}>{persona.emoji}</Text>
          </View>
          <View style={styles.personaText}>
            <Text style={styles.personaEyebrow}>Selected Path</Text>
            <Text style={styles.personaTitle}>{persona.title}</Text>
            <Text style={styles.personaSubtitle}>{persona.subtitle}</Text>
          </View>
        </View>
      ) : null}

      <View style={[commonStyles.card, styles.field]}>
        <Text style={styles.label}>What should we call you?</Text>
        <TextInput
          style={styles.input}
          value={draft.displayName}
          onChangeText={(value) => setDraft({ displayName: value })}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>

      {needsSalaryDay ? (
        <View style={[commonStyles.card, styles.field]}>
          <Text style={styles.label}>{monthlyMoneyLabel}</Text>
          <TextInput
            keyboardType="numeric"
            style={styles.input}
            value={draft.salaryDayOfMonth}
            onChangeText={(value) => setDraft({ salaryDayOfMonth: value })}
            placeholder={monthlyMoneyPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      ) : null}

      {needsScope
        ? trackingScopeOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              title={option.title}
              subtitle={option.subtitle}
              icon="layers-outline"
              selected={draft.trackingScope === option.value}
              onPress={() =>
                setDraft({
                  trackingScope: option.value,
                  businessModeEnabled: option.value === "home_and_business" || draft.userType === "business_self_employed"
                })
              }
            />
          ))
        : null}

      <Button
        label={saving ? "Saving..." : "Save And See My First Answer"}
        disabled={saving || !draft.userType || !draft.incomePattern}
        onPress={async () => {
          try {
            await saveOnboarding();
            if (userId) {
              await loadSampleStatement(userId);
              await refreshDashboard();
            }
            router.replace("/(tabs)/home");
          } catch {
            return;
          }
        }}
      />

      {saving ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>Saving your setup, loading sample history, and preparing your first answer.</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  personaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4D6"
  },
  avatarEmoji: {
    fontSize: 34
  },
  personaText: {
    flex: 1,
    gap: 4
  },
  personaEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  personaTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  personaSubtitle: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  field: {
    gap: theme.spacing.sm
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.body,
    color: theme.colors.text
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  help: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  }
});
