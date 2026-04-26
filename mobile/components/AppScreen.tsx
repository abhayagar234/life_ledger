import { PropsWithChildren, ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { commonStyles, theme } from "../theme";

type AppScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  scroll?: boolean;
}>;

export function AppScreen({ title, subtitle, headerRight, children, scroll = true }: AppScreenProps) {
  const content = (
    <View style={commonStyles.content}>
      {(title || subtitle || headerRight) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerRight}
        </View>
      )}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={commonStyles.screen}>
      <StatusBar style="dark" />
      {scroll ? <ScrollView contentInsetAdjustmentBehavior="automatic">{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.lg
  },
  headerText: {
    flex: 1,
    gap: theme.spacing.sm
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: "700",
    color: theme.colors.text
  },
  subtitle: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  }
});
