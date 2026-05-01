import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { languageOptions, t } from "../../i18n";
import { useSessionStore } from "../../store/session";
import { theme } from "../../theme";

export default function WelcomeScreen() {
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const setDraft = useSessionStore((state) => state.setDraft);

  return (
    <AppScreen scroll={false}>
      <LinearGradient colors={["#0E5B57", "#093E3B"]} style={styles.hero}>
        <Text style={styles.overline}>{t(language, "appName")}</Text>
        <Text style={styles.title}>{t(language, "welcomeTitle")}</Text>
        <Text style={styles.body}>{t(language, "welcomeBody")}</Text>
        <Text style={styles.trust}>{t(language, "welcomeTrust")}</Text>
      </LinearGradient>

      <View style={styles.footer}>
        <Text style={styles.languageTitle}>{t(language, "chooseLanguage")}</Text>
        <View style={styles.languageList}>
          {languageOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              title={option.label}
              subtitle={option.subtitle}
              icon="language-outline"
              selected={language === option.value}
              onPress={() => setDraft({ preferredLanguage: option.value })}
            />
          ))}
        </View>
        <Button label={t(language, "start")} onPress={() => router.push("/onboarding/user-type")} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    justifyContent: "flex-end",
    gap: theme.spacing.md
  },
  overline: {
    fontSize: theme.typography.caption,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    color: theme.colors.white
  },
  body: {
    fontSize: 18,
    lineHeight: 26,
    color: "rgba(255,255,255,0.88)"
  },
  trust: {
    fontSize: theme.typography.body,
    color: "rgba(255,255,255,0.76)"
  },
  footer: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md
  },
  languageTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  languageList: {
    gap: theme.spacing.sm
  }
});
