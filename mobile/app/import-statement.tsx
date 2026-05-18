import { File } from "expo-file-system";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import { formatMoney, prettyCategory } from "../features/imports/categoryOptions";
import {
  confirmPatternDue,
  getImportFileStatus,
  getImportCoverageLite,
  getRecurringDues,
  isImportProcessing,
  loadSampleStatement,
  uploadImportFile,
  waitForImportProcessing
} from "../services/api/moneyos";
import type {
  DetectedDueResponse,
  FileUploadResponse,
  ImportCoverageLiteResponse
} from "../services/api/types";
import { t } from "../i18n";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

type Step = "choose" | "real_upload" | "real_insights" | "sample_insights";

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

function topSpendCategories(topCategories: Record<string, number> | undefined, limit = 5) {
  if (!topCategories) {
    return [];
  }
  return Object.entries(topCategories)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

const CREDIT_CARD_INSIGHT_LABELS: Record<string, string> = {
  statement_total_due: "Total due",
  statement_min_due: "Minimum due",
  statement_payment_due_date_text: "Payment due",
  statement_period_start_text: "Period start",
  statement_period_end_text: "Period end"
};

function creditCardInsightRows(insights: Record<string, string> | null | undefined) {
  if (!insights) {
    return [];
  }
  return Object.entries(insights)
    .filter(([key, value]) => Boolean(value) && Boolean(CREDIT_CARD_INSIGHT_LABELS[key]))
    .map(([key, value]) => [CREDIT_CARD_INSIGHT_LABELS[key], value] as const);
}

function isImportReady(upload: FileUploadResponse) {
  return upload.status === "processed" && (upload.imported_rows > 0 || upload.duplicate_rows > 0);
}

function upsertUpload(current: FileUploadResponse[], nextUpload: FileUploadResponse) {
  const existingIndex = current.findIndex((item) => item.upload_id === nextUpload.upload_id);
  if (existingIndex === -1) {
    return [...current, nextUpload];
  }
  return current.map((item, index) => (index === existingIndex ? nextUpload : item));
}

export default function ImportStatementScreen() {
  const userId = useSessionStore((state) => state.userId);
  const profile = useSessionStore((state) => state.profile);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const markHasRealData = useSessionStore((state) => state.markHasRealData);
  const markSampleData = useSessionStore((state) => state.markSampleData);
  const cashflowSummary = useSessionStore((state) => state.dashboard.cashflowSummary);
  const spendingSummary = useSessionStore((state) => state.dashboard.spendingSummary);

  const [step, setStep] = useState<Step>("choose");
  const [uploading, setUploading] = useState(false);
  const [uploadingSource, setUploadingSource] = useState<"bank" | "card" | "other" | null>(null);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [loadingRecurringDues, setLoadingRecurringDues] = useState(false);
  const [sessionUploads, setSessionUploads] = useState<FileUploadResponse[]>([]);
  const [importCoverage, setImportCoverage] = useState<ImportCoverageLiteResponse | null>(null);
  const [detectedDues, setDetectedDues] = useState<DetectedDueResponse[]>([]);
  const [confirmingSampleDues, setConfirmingSampleDues] = useState(false);
  const [selectedSampleDueKeys, setSelectedSampleDueKeys] = useState<Record<string, boolean>>({});
  const [hiddenSampleDueKeys, setHiddenSampleDueKeys] = useState<Record<string, boolean>>({});
  const lastImportAlertRef = useRef<{ key: string; at: number } | null>(null);

  const confirmableDetectedDues = useMemo(
    () => detectedDues.filter((due) => due.frequency === "weekly" || due.frequency === "monthly"),
    [detectedDues]
  );
  const readySessionUploads = useMemo(
    () => sessionUploads.filter(isImportReady),
    [sessionUploads]
  );
  const processingSessionUploads = useMemo(
    () => sessionUploads.filter((item) => isImportProcessing(item.status)),
    [sessionUploads]
  );
  const readyUploadIds = useMemo(
    () => readySessionUploads.map((item) => item.upload_id),
    [readySessionUploads]
  );
  const readyUploadIdsParam = useMemo(
    () => readyUploadIds.join(","),
    [readyUploadIds]
  );
  const hasDuesToReview = confirmableDetectedDues.length > 0;
  const samplePendingDues = useMemo(
    () =>
      (cashflowSummary?.pending_pattern_dues ?? [])
        .filter((item) => !hiddenSampleDueKeys[item.due_key])
        .filter((item) => item.status !== "paid" && item.remaining_amount > 0)
        .sort((a, b) => b.remaining_amount - a.remaining_amount)
        .slice(0, 4),
    [cashflowSummary?.pending_pattern_dues, hiddenSampleDueKeys]
  );
  const selectedSampleCount = useMemo(
    () => samplePendingDues.filter((item) => selectedSampleDueKeys[item.due_key] !== false).length,
    [samplePendingDues, selectedSampleDueKeys]
  );

  useEffect(() => {
    if (step !== "sample_insights") {
      return;
    }
    if (!samplePendingDues.length) {
      setSelectedSampleDueKeys({});
      return;
    }
    setSelectedSampleDueKeys((current) => {
      const next: Record<string, boolean> = {};
      for (const due of samplePendingDues) {
        next[due.due_key] = current[due.due_key] ?? true;
      }
      return next;
    });
  }, [samplePendingDues, step]);

  function resetFlow(nextStep: Step = "choose") {
    setSessionUploads([]);
    setImportStatusMessage(null);
    setLoadingRecurringDues(false);
    setImportCoverage(null);
    setDetectedDues([]);
    setSelectedSampleDueKeys({});
    setHiddenSampleDueKeys({});
    setStep(nextStep);
  }

  function showImportAlertOnce(title: string, message: string) {
    const now = Date.now();
    const key = `${title}:${message}`;
    const last = lastImportAlertRef.current;
    if (last && last.key === key && now - last.at < 1500) {
      return;
    }
    lastImportAlertRef.current = { key, at: now };
    Alert.alert(title, message);
  }

  if (!profile) {
    return (
      <AppScreen title={t(language, "finishSetup")} subtitle={t(language, "finalStepSubtitle")}>
        <Button label={t(language, "finishSetup")} onPress={() => router.replace("/onboarding")} />
      </AppScreen>
    );
  }

  async function uploadOneStatement(sourceHint: "bank" | "card" | "other") {
    if (!userId) {
      showImportAlertOnce("Missing session", "Please reload the app once.");
      return;
    }
    try {
      setUploading(true);
      setUploadingSource(sourceHint);
      setImportStatusMessage("Opening file picker...");
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

      setImportStatusMessage("Uploading statement...");
      const initialResult = await uploadImportFile(userId, { uri, name: pickedName, mimeType }, sourceHint);
      setSessionUploads((current) => upsertUpload(current, initialResult));

      const result = isImportProcessing(initialResult.status)
        ? await waitForImportProcessing(userId, initialResult.upload_id, (status) => {
            setImportStatusMessage("Reading statement...");
            setSessionUploads((current) => upsertUpload(current, status));
          })
        : initialResult;
      setSessionUploads((current) => upsertUpload(current, result));

      if (isImportProcessing(result.status)) {
        showImportAlertOnce("Still processing", "This statement is taking longer than usual. You can check again in a moment.");
        return;
      }

      const isProcessed = result.status === "processed";
      const hasAnyRows = result.imported_rows > 0 || result.duplicate_rows > 0;
      if (isProcessed && hasAnyRows) {
        markHasRealData();
        if (result.message.toLowerCase().includes("cache")) {
          showImportAlertOnce("Already loaded", "This statement is ready.");
        } else if (result.imported_rows > 0) {
          showImportAlertOnce("Uploaded", "Statement is ready.");
        } else {
          showImportAlertOnce("No new rows", "This statement was already imported earlier.");
        }
      } else {
        const detail = result.message || "We could not read this statement.";
        const samples = result.error_samples?.length ? `\n\n${result.error_samples.slice(0, 2).join("\n")}` : "";
        showImportAlertOnce("Import failed", `${detail}${samples}`);
      }
    } catch (error) {
      showImportAlertOnce("Import failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
      setUploadingSource(null);
      setImportStatusMessage(null);
    }
  }

  async function generateInsights() {
    if (!userId || readySessionUploads.length === 0) {
      return;
    }
    const uploadIds = readySessionUploads.map((item) => item.upload_id);
    try {
      setUploading(true);
      setImportStatusMessage("Loading summary...");
      const coverage = await getImportCoverageLite(userId, uploadIds);
      setImportCoverage(coverage);
      setDetectedDues([]);
      setStep("real_insights");
      void loadRecurringDuesForUploads(uploadIds);
      void refreshDashboard({ includeSecondary: false, force: true });
    } catch (error) {
      Alert.alert("Could not generate insights", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
      setImportStatusMessage(null);
    }
  }

  async function loadRecurringDuesForUploads(uploadIds: string[]) {
    if (!userId || uploadIds.length === 0) {
      return;
    }
    try {
      setLoadingRecurringDues(true);
      const dues = await getRecurringDues(userId, uploadIds);
      setDetectedDues(dues);
    } catch (error) {
      showImportAlertOnce("Recurring dues delayed", error instanceof Error ? error.message : "Try again in a few seconds.");
    } finally {
      setLoadingRecurringDues(false);
    }
  }

  async function refreshProcessingUploads() {
    if (!userId || processingSessionUploads.length === 0) {
      return;
    }
    try {
      setUploading(true);
      setImportStatusMessage("Checking processing status...");
      const refreshed = await Promise.all(
        sessionUploads.map((item) =>
          isImportProcessing(item.status) ? getImportFileStatus(userId, item.upload_id) : Promise.resolve(item)
        )
      );
      setSessionUploads(refreshed);
      const readyCount = refreshed.filter(isImportReady).length;
      if (readyCount > 0) {
        showImportAlertOnce("Ready", `${readyCount} statement(s) are ready for insights.`);
      } else {
        showImportAlertOnce("Still processing", "We are still reading the statement. Check again in a moment.");
      }
    } catch (error) {
      Alert.alert("Could not check status", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
      setImportStatusMessage(null);
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
      await refreshDashboard({ includeSecondary: true, force: true });
      Alert.alert("Sample ready", result.message);
      setStep("sample_insights");
    } catch (error) {
      Alert.alert("Could not load sample", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoadingSample(false);
    }
  }

  async function continueToHome() {
    try {
      setUploading(true);
      await refreshDashboard({ includeSecondary: false, force: true });
      router.replace("/(tabs)/home");
    } catch (error) {
      Alert.alert("Could not open Home", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function openRecurringDues() {
    if (!readyUploadIdsParam) {
      return;
    }
    router.push({
      pathname: "/import-recurring-dues",
      params: { upload_ids: readyUploadIdsParam }
    });
  }

  function openCategorizeMerchants() {
    if (!readyUploadIdsParam) {
      return;
    }
    router.push({
      pathname: "/import-categorize",
      params: { upload_ids: readyUploadIdsParam }
    });
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
            onPress={() => {
              void loadSample();
            }}
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
                  {friendlyUploadLabel(item, sessionUploads.length - Math.min(3, sessionUploads.length) + idx)} ·{" "}
                  {isImportProcessing(item.status) ? "processing" : "ready"}
                </Text>
              ))}
            </View>
          ) : null}
          {processingSessionUploads.length > 0 && readySessionUploads.length === 0 ? (
            <Button label="Check processing" disabled={uploading} onPress={refreshProcessingUploads} />
          ) : (
            <Button label={t(language, "generateInsights")} disabled={readySessionUploads.length === 0 || uploading} onPress={generateInsights} />
          )}
          <Button label={t(language, "back")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

      {step === "real_insights" && importCoverage ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "insightsSummary")}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "moneyOut")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage.total_spend)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "moneyIn")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage.total_income)}</Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "upiSpend")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage.total_upi)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "cashWithdrawal")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(importCoverage.total_cash_withdrawal)}</Text>
            </View>
          </View>

          {topSpendCategories(importCoverage.top_categories_overall).length > 0 ? (
            <View style={styles.summarySection}>
              <Text style={styles.recurringLabel}>{t(language, "topSpendCategories")}</Text>
              {topSpendCategories(importCoverage.top_categories_overall).map(([category, amount]) => (
                <Text key={category} style={styles.recurringAmount}>
                  {prettyCategory(category) || category}: {formatMoney(amount)}
                </Text>
              ))}
            </View>
          ) : null}

          {importCoverage?.top_merchants_overall && Object.keys(importCoverage.top_merchants_overall).length > 0 ? (
            <View style={styles.summarySection}>
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

          {creditCardInsightRows(importCoverage.credit_card_insights).length > 0 ? (
            <View style={styles.summarySection}>
              <Text style={styles.recurringLabel}>Card Statement</Text>
              {creditCardInsightRows(importCoverage.credit_card_insights).map(([label, value]) => (
                <Text key={label} style={styles.recurringAmount}>
                  {label}: {value}
                </Text>
              ))}
            </View>
          ) : null}

          {loadingRecurringDues ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.help}>Finding recurring dues...</Text>
            </View>
          ) : null}

          <View style={[styles.actionCard, hasDuesToReview ? styles.actionCardPrimary : null]}>
            <View style={styles.actionCopy}>
              <Text style={styles.actionEyebrow}>{hasDuesToReview ? "Recommended" : "Optional cleanup"}</Text>
              <Text style={styles.actionTitle}>{hasDuesToReview ? "Protect fixed payments" : "Improve categories"}</Text>
              <Text style={styles.body}>
                {hasDuesToReview
                  ? "Review the recurring payments we found. Home will keep confirmed dues aside before showing safe-to-spend."
                  : "Name new merchants when you have a minute. Home already has enough to continue."}
              </Text>
            </View>
            {loadingRecurringDues || hasDuesToReview ? (
              <Button
                label={
                  loadingRecurringDues
                    ? "Finding recurring dues..."
                    : `Fix Recurring Dues (${confirmableDetectedDues.length})`
                }
                disabled={loadingRecurringDues}
                onPress={openRecurringDues}
              />
            ) : null}
            <Button
              label="Categorize Merchants"
              onPress={openCategorizeMerchants}
              variant="secondary"
            />
          </View>

          <Button
            label={hasDuesToReview ? "Skip For Now" : t(language, "continueToHome")}
            disabled={uploading}
            variant={hasDuesToReview ? "ghost" : "primary"}
            onPress={continueToHome}
          />
          <Button label={t(language, "startOver")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

      {step === "sample_insights" ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "insightsSummary")}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "moneyOut")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(spendingSummary?.total_spend ?? 0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t(language, "moneyIn")}</Text>
              <Text style={styles.summaryValue}>{formatMoney(spendingSummary?.monthly_income ?? 0)}</Text>
            </View>
          </View>
          {spendingSummary?.top_categories?.length ? (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>{t(language, "topSpendCategories")}</Text>
              {spendingSummary.top_categories.slice(0, 5).map((category) => (
                <Text key={category.category} style={styles.recurringAmount}>
                  {prettyCategory(category.category) || category.category}: {formatMoney(category.amount)}
                </Text>
              ))}
            </View>
          ) : null}
          {samplePendingDues.length ? (
            <View style={[styles.actionCard, styles.actionCardPrimary]}>
              <View style={styles.actionCopy}>
                <Text style={styles.actionEyebrow}>Sample setup</Text>
                <Text style={styles.actionTitle}>{t(language, "recurringDuesFound")}</Text>
                <Text style={styles.body}>
                  Sample mode can protect these fixed payments automatically, so you can see the Home number without reviewing future dates.
                </Text>
              </View>
              <Button
                label={confirmingSampleDues ? "Protecting..." : "Protect Sample Dues"}
                disabled={confirmingSampleDues || selectedSampleCount === 0 || !userId}
                onPress={async () => {
                  if (!userId) {
                    return;
                  }
                  const toConfirm = samplePendingDues.filter((item) => selectedSampleDueKeys[item.due_key] !== false);
                  if (!toConfirm.length) {
                    return;
                  }
                  try {
                    setConfirmingSampleDues(true);
                    for (const item of toConfirm) {
                      await confirmPatternDue(userId, item.name, item.remaining_amount, item.due_date, "monthly");
                    }
                    setHiddenSampleDueKeys((current) => ({
                      ...current,
                      ...Object.fromEntries(toConfirm.map((item) => [item.due_key, true]))
                    }));
                    await refreshDashboard({ includeSecondary: false, force: true });
                    Alert.alert("Done", "Dues confirmed and added to Home.");
                  } catch (error) {
                    Alert.alert("Could not confirm dues", error instanceof Error ? error.message : "Please try again.");
                  } finally {
                    setConfirmingSampleDues(false);
                  }
                }}
              />
            </View>
          ) : null}
          <Button label={t(language, "continueToHome")} disabled={uploading} onPress={continueToHome} />
          <Button label={t(language, "startOver")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

      {loadingSample || uploading || confirmingSampleDues ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>{importStatusMessage ?? t(language, "importBuilding")}</Text>
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
  summarySection: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md
  },
  actionCard: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: "#F7F8F5",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "#E1E7DE"
  },
  actionCardPrimary: {
    backgroundColor: "#FFF8EA",
    borderColor: "#E8D39B"
  },
  actionCopy: {
    gap: 4
  },
  actionEyebrow: {
    fontSize: theme.typography.caption,
    fontWeight: "700",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  actionTitle: {
    fontSize: theme.typography.body,
    fontWeight: "800",
    color: theme.colors.text
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
  }
});
