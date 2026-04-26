import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { theme } from "../../theme";

export default function WelcomeScreen() {
  return (
    <AppScreen scroll={false}>
      <LinearGradient colors={["#0E5B57", "#093E3B"]} style={styles.hero}>
        <Text style={styles.overline}>Life Ledger MoneyOS</Text>
        <Text style={styles.title}>Money made simple</Text>
        <Text style={styles.body}>Track income, expense, cash, and loans in one calm place.</Text>
        <Text style={styles.trust}>No bank connection needed to start.</Text>
      </LinearGradient>

      <View style={styles.footer}>
        <Button label="Start" onPress={() => router.push("/onboarding/user-type")} />
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
    marginTop: theme.spacing.xl
  }
});
