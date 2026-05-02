import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { getTrackingScopeOptions } from "../../features/onboarding/options";
import { LanguageCode, t } from "../../i18n";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

function selectedPersona(userType: string | null, language: LanguageCode) {
  switch (userType) {
    case "salaried":
      return {
        emoji: "💼",
        title: language === "hi" ? "वेतनभोगी" : language === "mr" ? "पगारदार" : "Salaried",
        subtitle:
          language === "hi"
            ? "मासिक वेतन, नौकरी और नियमित बिल"
            : language === "mr"
              ? "मासिक पगार, नोकरी आणि नियमित बिले"
              : "Monthly salary, office work, regular bills"
      };
    case "daily_wage":
      return {
        emoji: "🛠️",
        title: language === "hi" ? "दिहाड़ी मज़दूर" : language === "mr" ? "रोजंदारी कामगार" : "Daily Wage",
        subtitle:
          language === "hi"
            ? "मज़दूरी, ड्राइविंग या रोज़ की कमाई"
            : language === "mr"
              ? "मजुरी, ड्रायव्हिंग किंवा रोजची कमाई"
              : "Construction, driving, labor, or daily cash work"
      };
    case "farmer_seasonal":
      return {
        emoji: "🌾",
        title: language === "hi" ? "किसान / मौसमी" : language === "mr" ? "शेतकरी / मोसमी" : "Farmer / Seasonal",
        subtitle:
          language === "hi"
            ? "फसल, मंडी या लहरों में आने वाली आय"
            : language === "mr"
              ? "पीक, बाजार किंवा टप्प्याटप्प्याने येणारी कमाई"
              : "Harvest money, seasonal sales, or income in waves"
      };
    case "business_self_employed":
      return {
        emoji: "🏪",
        title: language === "hi" ? "व्यवसाय / स्वयंरोज़गार" : language === "mr" ? "व्यवसाय / स्वयंरोजगार" : "Business / Self-Employed",
        subtitle:
          language === "hi"
            ? "दुकान, फ्रीलांस, सेवा काम या मिला-जुला पैसा"
            : language === "mr"
              ? "दुकान, फ्रीलान्स, सेवा काम किंवा मिसळलेले पैसे"
              : "Shop, service work, freelancing, or mixed money"
      };
    case "family_manager":
      return {
        emoji: "🏠",
        title: language === "hi" ? "परिवार संभालने वाले" : language === "mr" ? "घराचा कारभारी" : "Family Manager",
        subtitle:
          language === "hi"
            ? "घर के पैसों को एक जगह दिखाई देने वाला"
            : language === "mr"
              ? "घरचे पैसे एका ठिकाणी दिसतील असे"
              : "Keeping household money visible in one place"
      };
    default:
      return null;
  }
}

function selectedPathCopy(language: LanguageCode) {
  if (language === "hi") {
    return "चुना हुआ रास्ता";
  }
  if (language === "mr") {
    return "निवडलेला मार्ग";
  }
  return "Selected Path";
}

export default function OnboardingCompleteScreen() {
  const draft = useSessionStore((state) => state.onboardingDraft);
  const setDraft = useSessionStore((state) => state.setDraft);
  const saveOnboarding = useSessionStore((state) => state.saveOnboarding);
  const saving = useSessionStore((state) => state.savingOnboarding);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const persona = useMemo(() => selectedPersona(draft.userType, language), [draft.userType, language]);
  const trackingScopeOptions = getTrackingScopeOptions(language);

  const needsSalaryDay = useMemo(() => draft.userType === "salaried" || draft.userType === "family_manager", [draft.userType]);
  const needsScope = useMemo(() => draft.userType === "family_manager", [draft.userType]);
  return (
    <AppScreen title={t(language, "finalStepTitle")} subtitle={t(language, "finalStepSubtitle")}>
      {persona ? (
        <View style={[commonStyles.card, commonStyles.shadow, styles.personaCard]}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarEmoji}>{persona.emoji}</Text>
          </View>
          <View style={styles.personaText}>
            <Text style={styles.personaEyebrow}>{selectedPathCopy(language)}</Text>
            <Text style={styles.personaTitle}>{persona.title}</Text>
            <Text style={styles.personaSubtitle}>{persona.subtitle}</Text>
          </View>
        </View>
      ) : null}

        <View style={[commonStyles.card, styles.field]}>
        <Text style={styles.label}>{t(language, "yourName")}</Text>
        <TextInput
          style={styles.input}
          value={draft.displayName}
          onChangeText={(value) => setDraft({ displayName: value })}
          placeholder={t(language, "yourNamePlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>

      {needsSalaryDay ? (
        <View style={[commonStyles.card, styles.field]}>
          <Text style={styles.label}>
            {draft.userType === "salaried"
              ? t(language, "salariedMoney")
              : draft.userType === "family_manager"
                ? t(language, "familyMoney")
                : t(language, "monthlyMoney")}
          </Text>
          <TextInput
            keyboardType="numeric"
            style={styles.input}
            value={draft.salaryDayOfMonth}
            onChangeText={(value) => setDraft({ salaryDayOfMonth: value })}
            placeholder={draft.userType === "salaried" ? t(language, "salariedExample") : t(language, "monthlyExample")}
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
                  businessModeEnabled: draft.userType === "business_self_employed"
                })
              }
            />
          ))
        : null}

      <Button
        label={saving ? t(language, "saving") : t(language, "finishSetup")}
        disabled={saving || !draft.userType}
        onPress={async () => {
          try {
            await saveOnboarding();
            router.replace("/(tabs)/home");
          } catch {
            return;
          }
        }}
      />

      {saving ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>{t(language, "saveHelp")}</Text>
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
