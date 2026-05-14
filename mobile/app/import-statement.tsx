import { File } from "expo-file-system";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import { loadSampleStatement, uploadImportFile, getDetectedDues, confirmDetectedDues, getImportSummary } from "../services/api/moneyos";
import type { ConfirmDueItem, DetectedDueResponse, FileUploadResponse, ImportSummaryResponse } from "../services/api/types";
import { t } from "../i18n";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

function formatMoney(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
}

function cleanPickedName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function dueDateFromEstimate(value?: string | null) {
  if (value) {
    return value;
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function dueKey(due: DetectedDueResponse) {
  return `${due.counterparty_name}:${due.amount}:${due.frequency}:${due.next_due_estimate ?? "no-date"}`;
}

function prettyCategory(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function periodLabel(summary: ImportSummaryResponse) {
  if (summary.period_months && summary.period_months >= 1) {
    if (summary.period_months <= 1.4) {
      return "1 month";
    }
    return `${Math.round(summary.period_months)} months`;
  }
  if (summary.period_days) {
    return `${summary.period_days} days`;
  }
  return "selected period";
}

export default function ImportStatementScreen() {
  const userId = useSessionStore((state) => state.userId);
  const profile = useSessionStore((state) => state.profile);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const markHasRealData = useSessionStore((state) => state.markHasRealData);
  const markSampleData = useSessionStore((state) => state.markSampleData);
  const [loadingSample, setLoadingSample] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadResult, setUploadResult] = useState<FileUploadResponse | null>(null);
  const [detectedDues, setDetectedDues] = useState<DetectedDueResponse[]>([]);
  const [selectedDues, setSelectedDues] = useState<Record<string, boolean>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [importSummary, setImportSummary] = useState<ImportSummaryResponse | null>(null);

  const selectedCount = useMemo(
    () =>
      detectedDues.filter(
        (due) =>
          selectedDues[dueKey(due)] !== false &&
          (due.frequency === "weekly" || due.frequency === "monthly")
      ).length,
    [detectedDues, selectedDues]
  );

  if (!profile) {
    return (
      <AppScreen title="Finish setup first" subtitle="We need your setup saved before import.">
        <Button label="Go Back To Setup" onPress={() => router.replace("/onboarding/complete")} />
      </AppScreen>
    );
  }

  return (
    <AppScreen title={t(language, "importTitle")} subtitle={t(language, "importSubtitle")}>
      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.title}>{t(language, "manualPath")}</Text>
        <Text style={styles.body}>{t(language, "importRealBody")}</Text>
        <Button
          label={uploading ? "Uploading..." : t(language, "pickStatementFile")}
          onPress={async () => {
            if (!userId) {
              Alert.alert("Missing session", "Please reload the app once.");
              return;
            }
            try {
              setUploading(true);
              const pickerType = Platform.OS === "android" ? "*/*" : "public.data";
              const pickedResult = await File.pickFileAsync(undefined, pickerType);
              const picked = Array.isArray(pickedResult) ? pickedResult[0] : pickedResult;
              if (!picked) {
                throw new Error("No file selected.");
              }
              const pickedFile = picked as any;
              const pickedName = cleanPickedName(pickedFile.name || pickedFile.fileName || "statement");
              const uri: string = pickedFile.uri || "";
              const rawExt = (
                pickedFile.extension ||
                pickedName.slice(Math.max(0, pickedName.lastIndexOf("."))) ||
                uri.slice(Math.max(0, uri.lastIndexOf(".")))
              ).toLowerCase();
              const mimeType =
                rawExt === ".pdf"
                  ? "application/pdf"
                  : rawExt === ".csv"
                    ? "text/csv"
                    : rawExt === ".xlsx"
                      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      : rawExt === ".xls"
                        ? "application/vnd.ms-excel"
                        : rawExt === ".txt"
                          ? "text/plain"
                          : "application/octet-stream";
              const result = await uploadImportFile(userId, {
                uri,
                name: pickedName,
                mimeType
              });
              const dues = await getDetectedDues(userId, result.upload_id);
              const summary = await getImportSummary(userId, result.upload_id);
              setUploadResult(result);
              setDetectedDues(dues);
              setImportSummary(summary);
              setSelectedDues(Object.fromEntries(dues.map((due) => [dueKey(due), true])));
              setCustomNames(Object.fromEntries(dues.map((due) => [dueKey(due), due.counterparty_name])));
              setCustomDates(Object.fromEntries(dues.map((due) => [dueKey(due), dueDateFromEstimate(due.next_due_estimate)])));
              markHasRealData();
              await refreshDashboard();
              const confirmableDues = dues.filter((due) => due.frequency === "weekly" || due.frequency === "monthly");
              if (confirmableDues.length === 0) {
                router.replace("/(tabs)/home");
              }
            } catch (error) {
              Alert.alert("Import failed", error instanceof Error ? error.message : "Please try again.");
            } finally {
              setUploading(false);
            }
          }}
        />
      </View>

      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.title}>{t(language, "sampleTitle")}</Text>
        <Text style={styles.body}>{t(language, "sampleBody")}</Text>
        <Button
          label={t(language, "useSample")}
          variant="secondary"
          onPress={async () => {
            if (!userId) {
              Alert.alert("Missing session", "Please reload the app once.");
              return;
            }
            setLoadingSample(true);
            try {
              const result = await loadSampleStatement(userId);
              markSampleData();
              await refreshDashboard();
              Alert.alert("Sample ready", result.message);
              router.replace("/(tabs)/home");
            } catch (error) {
              Alert.alert("Could not load sample", error instanceof Error ? error.message : "Please try again.");
            } finally {
              setLoadingSample(false);
            }
          }}
        />
      </View>

      {uploadResult && importSummary ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>✅ Import Successful</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Transactions</Text>
              <Text style={styles.summaryValue}>{uploadResult.imported_rows}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Statement Period</Text>
              <Text style={styles.summaryValue}>{periodLabel(importSummary)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Spend</Text>
              <Text style={styles.summaryValue}>{formatMoney(importSummary.total_spend)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Income</Text>
              <Text style={styles.summaryValue}>{formatMoney(importSummary.total_income)}</Text>
            </View>
          </View>
          <View style={styles.detailsGrid}>
            {importSummary.total_upi > 0 ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>UPI Spend (this period)</Text>
                <Text style={styles.detailValue}>{formatMoney(importSummary.total_upi)}</Text>
              </View>
            ) : null}
            {importSummary.total_cash_withdrawal > 0 ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Cash Withdrawn (this period)</Text>
                <Text style={styles.detailValue}>{formatMoney(importSummary.total_cash_withdrawal)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.insightsRow}>
            {importSummary.most_spent_category ? (
              <View style={styles.insightBadge}>
                <Text style={styles.insightLabel}>Most Spent</Text>
                <Text style={styles.insightCategory}>{prettyCategory(importSummary.most_spent_category)}</Text>
                {importSummary.most_spent_amount ? (
                  <Text style={styles.insightDate}>{formatMoney(importSummary.most_spent_amount)}</Text>
                ) : null}
              </View>
            ) : null}
            {importSummary.date_range ? (
              <View style={styles.insightBadge}>
                <Text style={styles.insightLabel}>Period</Text>
                <Text style={styles.insightDate}>
                  {new Date(importSummary.date_range[0]).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric"
                  })} - {new Date(importSummary.date_range[1]).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric"
                  })}
                </Text>
              </View>
            ) : null}
          </View>
          {detectedDues.length > 0 ? (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>Recurring Detected</Text>
              <Text style={styles.recurringValue}>{detectedDues.length} payments</Text>
              <Text style={styles.recurringAmount}>
                {formatMoney(
                  detectedDues
                    .filter((d) => d.frequency === "monthly")
                    .reduce((sum, d) => sum + d.amount, 0)
                )} monthly
              </Text>
            </View>
          ) : null}
        </View>
      ) : uploadResult ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>✅ Import Successful</Text>
          <Text style={styles.body}>
            {uploadResult.imported_rows} transactions loaded successfully
          </Text>
        </View>
      ) : null}

      {detectedDues.length ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "recurringDuesFound")}</Text>
          <Text style={styles.body}>{t(language, "recurringDuesBody")}</Text>
          <ScrollView style={styles.duesList}>
            {detectedDues.map((due) => {
              const key = dueKey(due);
              const selected = selectedDues[key] !== false;
              const confirmable = due.frequency === "weekly" || due.frequency === "monthly";
              return (
                <View key={key} style={styles.dueWrap}>
                  <ChoiceCard
                    title={`${due.counterparty_name.replace(/_/g, " ").replace(/ en$/, "").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} · ${formatMoney(due.amount)}`}
                    subtitle={`${due.frequency.charAt(0).toUpperCase() + due.frequency.slice(1)}${confirmable ? "" : " · review only"}`}
                    icon="repeat-outline"
                    selected={selected && confirmable}
                    onPress={() =>
                      confirmable
                        ? setSelectedDues((current) => ({
                            ...current,
                            [key]: !selected
                          }))
                        : undefined
                    }
                  />
                  {!confirmable ? <Text style={styles.noteText}>{t(language, "irregularReviewNote")}</Text> : null}
                  {selected && confirmable ? (
                    <>
                      <TextInput
                        value={customNames[key] ?? due.counterparty_name}
                        onChangeText={(value) =>
                          setCustomNames((current) => ({
                            ...current,
                            [key]: value
                          }))
                        }
                        placeholder={t(language, "renameIfNeeded")}
                        placeholderTextColor={theme.colors.textMuted}
                        style={styles.input}
                      />
                      <TextInput
                        value={customDates[key] ?? dueDateFromEstimate(due.next_due_estimate)}
                        onChangeText={(value) =>
                          setCustomDates((current) => ({
                            ...current,
                            [key]: value
                          }))
                        }
                        placeholder="Due date (YYYY-MM-DD)"
                        placeholderTextColor={theme.colors.textMuted}
                        style={styles.input}
                      />
                    </>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <Button
            label={confirming ? "Confirming..." : `${t(language, "confirmDuesCta")} (${selectedCount})`}
            disabled={confirming || selectedCount === 0 || !uploadResult}
            onPress={async () => {
              if (!userId || !uploadResult) {
                return;
              }
              const confirmed: ConfirmDueItem[] = detectedDues
                .filter(
                  (due) =>
                    selectedDues[dueKey(due)] !== false &&
                    (due.frequency === "weekly" || due.frequency === "monthly")
                )
                .map((due) => ({
                  counterparty_name: due.counterparty_name,
                  amount: due.amount,
                  frequency: due.frequency,
                  next_due_date: customDates[dueKey(due)] || dueDateFromEstimate(due.next_due_estimate),
                  custom_name: customNames[dueKey(due)] || due.counterparty_name
                }));

              try {
                setConfirming(true);
                const result = await confirmDetectedDues(userId, uploadResult.upload_id, confirmed);
                markHasRealData();
                await refreshDashboard();
                Alert.alert(
                  "✅ All set!",
                  `${selectedCount} recurring payment${selectedCount !== 1 ? 's' : ''} will be protected from your next income.`,
                  [
                    {
                      text: "Go to Home",
                      onPress: () => router.replace("/(tabs)/home"),
                      isPreferred: true
                    }
                  ]
                );
              } catch (error) {
                Alert.alert("Could not confirm dues", error instanceof Error ? error.message : "Please try again.");
              } finally {
                setConfirming(false);
              }
            }}
          />
        </View>
      ) : null}

      {uploadResult ? (
        <Button label={t(language, "continueToHome")} onPress={() => router.replace("/(tabs)/home")} />
      ) : null}

      <Button label={t(language, "backHome")} variant="secondary" onPress={() => router.back()} />

      {loadingSample || uploading || confirming ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>{t(language, "importBuilding")}</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm
  },
  title: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  body: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  duesList: {
    maxHeight: 360
  },
  dueWrap: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  input: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body,
    color: theme.colors.text
  },
  noteText: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  help: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  summaryGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm
  },
  summaryLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs
  },
  summaryValue: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.primary
  },
  detailsGrid: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  detailItem: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary
  },
  detailLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4
  },
  detailValue: {
    fontSize: theme.typography.body,
    fontWeight: "600",
    color: theme.colors.text
  },
  recurringSection: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary
  },
  recurringLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4
  },
  recurringValue: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.primary,
    marginBottom: 4
  },
  recurringAmount: {
    fontSize: theme.typography.caption,
    color: theme.colors.text
  },
  insightsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    justifyContent: "space-between"
  },
  insightBadge: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  insightLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2
  },
  insightCategory: {
    fontSize: theme.typography.body,
    fontWeight: "600",
    color: theme.colors.primary
  },
  insightDate: {
    fontSize: theme.typography.body,
    fontWeight: "600",
    color: theme.colors.text
  }
});
