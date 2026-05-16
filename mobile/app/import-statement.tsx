import { File } from "expo-file-system";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import {
  confirmDetectedDues,
  getImportCoverage,
  getImportSummary,
  loadSampleStatement,
  saveCategoryMappings,
  uploadImportFile
} from "../services/api/moneyos";
import type {
  CategoryHelpCandidate,
  CategoryMappingItem,
  ConfirmDueItem,
  DetectedDueResponse,
  FileUploadResponse,
  ImportCoverageResponse,
  ImportSummaryResponse
} from "../services/api/types";
import { t } from "../i18n";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

type Step = "choose" | "real_upload" | "real_insights" | "sample_load" | "sample_insights";

const CATEGORY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "groceries", label: "Groceries" },
  { code: "health", label: "Hospital / Health" },
  { code: "travel", label: "Travel / Fuel" },
  { code: "bills", label: "Bills / Utilities" },
  { code: "shopping", label: "Shopping" },
  { code: "dining", label: "Dining / Food" },
  { code: "subscriptions", label: "Subscriptions" },
  { code: "education", label: "Education" },
  { code: "transfers", label: "Transfer / Personal" },
  { code: "uncategorized", label: "Other" }
];

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

function compactFileName(value: string) {
  const name = cleanPickedName(value || "");
  if (name.length <= 34) {
    return name;
  }
  return `${name.slice(0, 14)}...${name.slice(-10)}`;
}

function looksEncodedOrUnreadable(value: string) {
  const v = value || "";
  if (!v.trim()) {
    return true;
  }
  if (/%[0-9A-Fa-f]{2}/.test(v)) {
    return true;
  }
  if (v.startsWith("acc%3D") || v.includes("doc%3Dencoded")) {
    return true;
  }
  return false;
}

function friendlyUploadLabel(item: FileUploadResponse, index: number) {
  const fallbackBase =
    item.source_type === "credit_card" || item.source_type === "card"
      ? "Card statement"
      : item.source_type === "bank"
        ? "Bank statement"
        : "Statement";
  const cleaned = compactFileName(item.file_name || "");
  if (looksEncodedOrUnreadable(cleaned)) {
    return `${fallbackBase} ${index + 1}`;
  }
  return cleaned;
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
  if (value === "uncategorized") {
    return "Other spends";
  }
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function topSpendCategories(topCategories: Record<string, number> | undefined, limit = 5) {
  if (!topCategories) {
    return [];
  }
  return Object.entries(topCategories)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function categoryLabel(categoryCode: string | undefined) {
  if (!categoryCode) {
    return "Choose category";
  }
  const found = CATEGORY_OPTIONS.find((item) => item.code === categoryCode);
  return found?.label ?? prettyCategory(categoryCode) ?? "Choose category";
}

export default function ImportStatementScreen() {
  const userId = useSessionStore((state) => state.userId);
  const profile = useSessionStore((state) => state.profile);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const markHasRealData = useSessionStore((state) => state.markHasRealData);
  const markSampleData = useSessionStore((state) => state.markSampleData);
  const cashflowSummary = useSessionStore((state) => state.dashboard.cashflowSummary);

  const [step, setStep] = useState<Step>("choose");
  const [uploading, setUploading] = useState(false);
  const [uploadingSource, setUploadingSource] = useState<"bank" | "card" | "other" | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionUploads, setSessionUploads] = useState<FileUploadResponse[]>([]);
  const [uploadResult, setUploadResult] = useState<FileUploadResponse | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummaryResponse | null>(null);
  const [importCoverage, setImportCoverage] = useState<ImportCoverageResponse | null>(null);
  const [detectedDues, setDetectedDues] = useState<DetectedDueResponse[]>([]);
  const [selectedDues, setSelectedDues] = useState<Record<string, boolean>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);
  const [savingCategories, setSavingCategories] = useState(false);

  const selectedCount = useMemo(
    () =>
      detectedDues.filter(
        (due) => selectedDues[dueKey(due)] !== false && (due.frequency === "weekly" || due.frequency === "monthly")
      ).length,
    [detectedDues, selectedDues]
  );
  const categoryHelpCandidates = useMemo(
    () => (importCoverage?.category_help_candidates ?? []).slice(0, 3),
    [importCoverage?.category_help_candidates]
  );

  function resetFlow(nextStep: Step = "choose") {
    setSessionUploads([]);
    setUploadResult(null);
    setImportSummary(null);
    setImportCoverage(null);
    setDetectedDues([]);
    setSelectedDues({});
    setCustomNames({});
    setCustomDates({});
    setCategorySelections({});
    setOpenCategoryKey(null);
    setStep(nextStep);
  }

  if (!profile) {
    return (
      <AppScreen title={t(language, "finishSetup")} subtitle={t(language, "finalStepSubtitle")}>
        <Button label={t(language, "finishSetup")} onPress={() => router.replace("/onboarding/complete")} />
      </AppScreen>
    );
  }

  async function uploadOneStatement(sourceHint: "bank" | "card" | "other") {
    if (!userId) {
      Alert.alert("Missing session", "Please reload the app once.");
      return;
    }
    try {
      setUploading(true);
      setUploadingSource(sourceHint);
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

      const result = await uploadImportFile(userId, { uri, name: pickedName, mimeType }, sourceHint);
      setUploadResult(result);
      setSessionUploads((current) => [...current, result]);
      markHasRealData();
      Alert.alert("Uploaded", `${result.imported_rows} rows imported.`);
    } catch (error) {
      Alert.alert("Import failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
      setUploadingSource(null);
    }
  }

  async function generateInsights() {
    if (!userId || sessionUploads.length === 0) {
      return;
    }
    try {
      setUploading(true);
      const latest = sessionUploads[sessionUploads.length - 1];
      const summary = await getImportSummary(userId, latest.upload_id);
      const coverage = await getImportCoverage(
        userId,
        sessionUploads.map((item) => item.upload_id)
      );
      const dues = coverage.recurring_dues ?? [];
      setImportSummary(summary);
      setImportCoverage(coverage);
      setDetectedDues(dues);
      setSelectedDues(Object.fromEntries(dues.map((due) => [dueKey(due), true])));
      setCustomNames(Object.fromEntries(dues.map((due) => [dueKey(due), due.counterparty_name])));
      setCustomDates(Object.fromEntries(dues.map((due) => [dueKey(due), dueDateFromEstimate(due.next_due_estimate)])));
      setCategorySelections({});
      setOpenCategoryKey(null);
      await refreshDashboard();
      setStep("real_insights");
    } catch (error) {
      Alert.alert("Could not generate insights", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function loadSample() {
    if (!userId) {
      Alert.alert("Missing session", "Please reload the app once.");
      return;
    }
    try {
      setLoadingSample(true);
      const result = await loadSampleStatement(userId);
      markSampleData();
      await refreshDashboard();
      Alert.alert("Sample ready", result.message);
      setStep("sample_insights");
    } catch (error) {
      Alert.alert("Could not load sample", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <AppScreen title={t(language, "importTitle")} subtitle={t(language, "importSubtitle")}>
      {step === "choose" ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "importTitle")}</Text>
          <ChoiceCard
            title={t(language, "manualPath")}
            subtitle={t(language, "manualPathSubtitle")}
            icon="cloud-upload-outline"
            selected={false}
            onPress={() => resetFlow("real_upload")}
          />
          <ChoiceCard
            title={t(language, "sampleTitle")}
            subtitle={t(language, "sampleBody")}
            icon="flask-outline"
            selected={false}
            onPress={() => resetFlow("sample_load")}
          />
        </View>
      ) : null}

      {step === "real_upload" ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "uploadStatementsTitle")}</Text>
          <Text style={styles.body}>{t(language, "uploadStatementsBody")}</Text>
          <Button
            label={uploadingSource === "bank" ? "Uploading..." : t(language, "uploadBankStatement")}
            disabled={uploading}
            onPress={() => uploadOneStatement("bank")}
          />
          <Button
            label={uploadingSource === "card" ? "Uploading..." : t(language, "uploadCardStatement")}
            disabled={uploading}
            variant="secondary"
            onPress={() => uploadOneStatement("card")}
          />
          <Button
            label={uploadingSource === "other" ? "Uploading..." : t(language, "uploadOtherStatement")}
            disabled={uploading}
            variant="secondary"
            onPress={() => uploadOneStatement("other")}
          />
          {sessionUploads.length > 0 ? (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>{t(language, "uploadedThisSession")}</Text>
              <Text style={styles.recurringAmount}>{sessionUploads.length} statement(s)</Text>
              {sessionUploads.slice(-3).map((item, idx) => (
                <Text key={item.upload_id} style={styles.recurringAmount}>
                  {friendlyUploadLabel(item, sessionUploads.length - Math.min(3, sessionUploads.length) + idx)} · {item.imported_rows} rows
                </Text>
              ))}
            </View>
          ) : null}
          <Button label={t(language, "generateInsights")} disabled={sessionUploads.length === 0 || uploading} onPress={generateInsights} />
          <Button label={t(language, "back")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

      {step === "real_insights" && importSummary ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "insightsSummary")}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "rowsImported")}</Text>
              <Text style={styles.summaryValue}>{importCoverage?.total_transactions ?? uploadResult?.imported_rows ?? 0}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "moneyOut")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage?.total_spend ?? importSummary.total_spend)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "moneyIn")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage?.total_income ?? importSummary.total_income)}</Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "upiSpend")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage?.total_upi ?? importSummary.total_upi ?? 0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "cashWithdrawal")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage?.total_cash_withdrawal ?? importSummary.total_cash_withdrawal ?? 0)}</Text>
            </View>
          </View>

          {topSpendCategories(importCoverage?.top_categories_overall ?? importCoverage?.top_categories_current_month ?? importSummary.top_categories).length > 0 ? (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>{t(language, "topSpendCategories")}</Text>
              {topSpendCategories(importCoverage?.top_categories_overall ?? importCoverage?.top_categories_current_month ?? importSummary.top_categories).map(([category, amount]) => (
                <Text key={category} style={styles.recurringAmount}>
                  {prettyCategory(category) || category}: {formatMoney(amount)}
                </Text>
              ))}
            </View>
          ) : null}

          {importCoverage?.top_merchants_overall && Object.keys(importCoverage.top_merchants_overall).length > 0 ? (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>Top Merchants</Text>
              {Object.entries(importCoverage.top_merchants_overall)
                .slice(0, 5)
                .map(([merchant, amount]) => (
                  <Text key={merchant} style={styles.recurringAmount}>
                    {merchant}: {formatMoney(amount)}
                  </Text>
                ))}
            </View>
          ) : null}

          {detectedDues.length > 0 ? (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>{t(language, "recurringDuesFound")}</Text>
              <Text style={styles.body}>Confirm the dues you want protected in safe-to-spend.</Text>
              <View style={styles.duesList}>
                {detectedDues.map((due) => {
                  const key = dueKey(due);
                  const selected = selectedDues[key] !== false;
                  const confirmable = due.frequency === "weekly" || due.frequency === "monthly";
                  return (
                    <View key={key} style={styles.dueWrap}>
                      <ChoiceCard
                        title={`${due.counterparty_name} · ${formatMoney(due.amount)}`}
                        subtitle={`${due.frequency}${confirmable ? "" : " · review only"}`}
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
                            placeholder="Rename if needed"
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
                            placeholder="Due date YYYY-MM-DD"
                            placeholderTextColor={theme.colors.textMuted}
                            style={styles.input}
                          />
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <Button
                label={confirming ? "Confirming..." : `Confirm Dues (${selectedCount})`}
                disabled={confirming || selectedCount === 0 || !uploadResult}
                onPress={async () => {
                  if (!userId || !uploadResult) {
                    return;
                  }
                  const confirmed: ConfirmDueItem[] = detectedDues
                    .filter((due) => selectedDues[dueKey(due)] !== false && (due.frequency === "weekly" || due.frequency === "monthly"))
                    .map((due) => ({
                      counterparty_name: due.counterparty_name,
                      amount: due.amount,
                      frequency: due.frequency,
                      next_due_date: customDates[dueKey(due)] || dueDateFromEstimate(due.next_due_estimate),
                      custom_name: customNames[dueKey(due)] || due.counterparty_name
                    }));
                  try {
                    setConfirming(true);
                    await confirmDetectedDues(userId, uploadResult.upload_id, confirmed);
                    await refreshDashboard();
                    const confirmedKeys = new Set(
                      detectedDues
                        .filter((due) => selectedDues[dueKey(due)] !== false && (due.frequency === "weekly" || due.frequency === "monthly"))
                        .map((due) => dueKey(due))
                    );
                    setDetectedDues((current) => current.filter((due) => !confirmedKeys.has(dueKey(due))));
                    setSelectedDues({});
                    setCustomNames({});
                    setCustomDates({});
                    Alert.alert("Done", "Recurring dues confirmed.");
                  } catch (error) {
                    Alert.alert("Could not confirm dues", error instanceof Error ? error.message : "Please try again.");
                  } finally {
                    setConfirming(false);
                  }
                }}
              />
            </View>
          ) : null}

          {categoryHelpCandidates.length > 0 ? (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>Help us categorize bigger spends (Rs 1,000+)</Text>
              <Text style={styles.body}>Pick category once. Next similar transactions will auto-map.</Text>
              <View style={styles.duesList}>
                {categoryHelpCandidates.map((candidate: CategoryHelpCandidate) => {
                  const selectedCategory = categorySelections[candidate.merchant_key];
                  const expanded = openCategoryKey === candidate.merchant_key;
                  return (
                    <View key={candidate.merchant_key} style={styles.mappingCard}>
                      <Text style={styles.mappingTitle}>{candidate.merchant_label}</Text>
                      <Text style={styles.mappingMeta}>
                        {formatMoney(candidate.total_amount)} · {candidate.transaction_count} transaction
                        {candidate.transaction_count > 1 ? "s" : ""}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setOpenCategoryKey((current) => (current === candidate.merchant_key ? null : candidate.merchant_key))
                        }
                        style={[styles.mappingPicker, expanded ? styles.mappingPickerOpen : null]}
                      >
                        <Text style={styles.mappingPickerText}>{categoryLabel(selectedCategory)}</Text>
                      </Pressable>
                      {expanded ? (
                        <View style={styles.chipWrap}>
                          {CATEGORY_OPTIONS.map((option) => {
                            const selected = selectedCategory === option.code;
                            return (
                              <Pressable
                                key={`${candidate.merchant_key}:${option.code}`}
                                onPress={() => {
                                  setCategorySelections((current) => ({
                                    ...current,
                                    [candidate.merchant_key]: option.code
                                  }));
                                  setOpenCategoryKey(null);
                                }}
                                style={[styles.chip, selected ? styles.chipSelected : null]}
                              >
                                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <Button
                label={savingCategories ? "Saving..." : "Save category mapping"}
                disabled={
                  savingCategories ||
                  categoryHelpCandidates.length === 0 ||
                  !categoryHelpCandidates.some((candidate) => Boolean(categorySelections[candidate.merchant_key]))
                }
                onPress={async () => {
                  if (!userId) {
                    return;
                  }
                  const mappings: CategoryMappingItem[] = categoryHelpCandidates
                    .filter((candidate) => Boolean(categorySelections[candidate.merchant_key]))
                    .map((candidate) => ({
                      merchant_key: candidate.merchant_key,
                      merchant_label: candidate.merchant_label,
                      category_code: categorySelections[candidate.merchant_key]
                    }));
                  if (mappings.length === 0) {
                    return;
                  }
                  try {
                    setSavingCategories(true);
                    await saveCategoryMappings(userId, mappings);
                    const refreshed = await getImportCoverage(
                      userId,
                      sessionUploads.map((item) => item.upload_id)
                    );
                    setImportCoverage(refreshed);
                    setCategorySelections({});
                    setOpenCategoryKey(null);
                    await refreshDashboard();
                    Alert.alert("Saved", "Thanks. We will auto-map these next time.");
                  } catch (error) {
                    Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
                  } finally {
                    setSavingCategories(false);
                  }
                }}
              />
            </View>
          ) : null}

          <Button label={t(language, "continueToHome")} onPress={() => router.replace("/(tabs)/home")} />
          <Button label={t(language, "startOver")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

      {step === "sample_load" ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "sampleTitle")}</Text>
          <Text style={styles.body}>{t(language, "sampleBody")}</Text>
          <Button label={loadingSample ? "Loading..." : t(language, "useSample")} variant="secondary" onPress={loadSample} />
          <Button label={t(language, "back")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

      {step === "sample_insights" && cashflowSummary ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>Sample Insights</Text>
          <Text style={styles.body}>Safe to spend: {formatMoney(cashflowSummary.safe_to_spend)}</Text>
          <Text style={styles.body}>Daily reserve: {formatMoney(cashflowSummary.daily_needs_required)}</Text>
          <Text style={styles.body}>Already spoken for: {formatMoney(cashflowSummary.upcoming_dues_total)}</Text>
          <Button label={t(language, "continueToHome")} onPress={() => router.replace("/(tabs)/home")} />
          <Button label={t(language, "startOver")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

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
    gap: theme.spacing.sm
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
  recurringAmount: {
    fontSize: theme.typography.caption,
    color: theme.colors.text,
    marginBottom: 2
  },
  mappingCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface
  },
  mappingTitle: {
    fontSize: theme.typography.body,
    fontWeight: "600",
    color: theme.colors.text
  },
  mappingMeta: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  mappingPicker: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted
  },
  mappingPickerOpen: {
    borderColor: theme.colors.primary
  },
  mappingPickerText: {
    fontSize: theme.typography.caption,
    color: theme.colors.text
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surfaceMuted
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  chipText: {
    fontSize: 12,
    color: theme.colors.text
  },
  chipTextSelected: {
    color: theme.colors.white
  }
});
