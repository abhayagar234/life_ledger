import { File } from "expo-file-system";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import {
  confirmDetectedDues,
  confirmPatternDue,
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

type Step = "choose" | "real_upload" | "real_insights" | "sample_insights";

const CATEGORY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "groceries", label: "Groceries" },
  { code: "health", label: "Hospital / Health" },
  { code: "travel", label: "Travel / Fuel" },
  { code: "bills", label: "Bills / Utilities" },
  { code: "emi_loans", label: "Loan / EMI" },
  { code: "rent", label: "Rent" },
  { code: "insurance", label: "Insurance" },
  { code: "savings_investments", label: "Investment / SIP" },
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
  const spendingSummary = useSessionStore((state) => state.dashboard.spendingSummary);

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
  const [dueCustomNames, setDueCustomNames] = useState<Record<string, string>>({});
  const [dueAmounts, setDueAmounts] = useState<Record<string, string>>({});
  const [dueCategorySelections, setDueCategorySelections] = useState<Record<string, string>>({});
  const [openDueCategoryKey, setOpenDueCategoryKey] = useState<string | null>(null);
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);
  const [savingCategories, setSavingCategories] = useState(false);
  const [showCategoryHelp, setShowCategoryHelp] = useState(false);
  const [confirmingSampleDues, setConfirmingSampleDues] = useState(false);
  const [selectedSampleDueKeys, setSelectedSampleDueKeys] = useState<Record<string, boolean>>({});
  const [hiddenSampleDueKeys, setHiddenSampleDueKeys] = useState<Record<string, boolean>>({});
  const lastImportAlertRef = useRef<{ key: string; at: number } | null>(null);

  const confirmableDetectedDues = useMemo(
    () => detectedDues.filter((due) => due.frequency === "weekly" || due.frequency === "monthly"),
    [detectedDues]
  );
  const selectedCount = useMemo(
    () =>
      confirmableDetectedDues.filter((due) => selectedDues[dueKey(due)] !== false).length,
    [confirmableDetectedDues, selectedDues]
  );
  const categoryHelpCandidates = useMemo(
    () => (importCoverage?.category_help_candidates ?? []).slice(0, 3),
    [importCoverage?.category_help_candidates]
  );
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

  useEffect(() => {
    if (!confirmableDetectedDues.length) {
      setDueCustomNames({});
      setDueAmounts({});
      setDueCategorySelections({});
      setOpenDueCategoryKey(null);
      return;
    }
    setDueCustomNames((current) => {
      const next = { ...current };
      for (const due of confirmableDetectedDues) {
        const key = dueKey(due);
        if (!next[key]) {
          next[key] = due.counterparty_name;
        }
      }
      return next;
    });
    setDueAmounts((current) => {
      const next = { ...current };
      for (const due of confirmableDetectedDues) {
        const key = dueKey(due);
        if (!next[key]) {
          next[key] = String(Math.round(due.amount));
        }
      }
      return next;
    });
    setDueCategorySelections((current) => {
      const next = { ...current };
      for (const due of confirmableDetectedDues) {
        const key = dueKey(due);
        if (!next[key] && due.category_code) {
          next[key] = due.category_code;
        }
      }
      return next;
    });
  }, [confirmableDetectedDues]);

  function resetFlow(nextStep: Step = "choose") {
    setSessionUploads([]);
    setUploadResult(null);
    setImportSummary(null);
    setImportCoverage(null);
    setDetectedDues([]);
    setSelectedDues({});
    setDueCustomNames({});
    setDueAmounts({});
    setDueCategorySelections({});
    setOpenDueCategoryKey(null);
    setCategorySelections({});
    setOpenCategoryKey(null);
    setShowCategoryHelp(false);
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
        <Button label={t(language, "finishSetup")} onPress={() => router.replace("/onboarding/complete")} />
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

      const isProcessed = result.status === "processed";
      const hasAnyRows = result.imported_rows > 0 || result.duplicate_rows > 0;
      if (isProcessed && hasAnyRows) {
        setSessionUploads((current) => [...current, result]);
        markHasRealData();
        if (result.imported_rows > 0) {
          showImportAlertOnce("Uploaded", `${result.imported_rows} rows imported.`);
        } else {
          showImportAlertOnce("No new rows", `${result.duplicate_rows} rows were already imported earlier.`);
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
      setDueCustomNames(Object.fromEntries(dues.map((due) => [dueKey(due), due.counterparty_name])));
      setDueAmounts(Object.fromEntries(dues.map((due) => [dueKey(due), String(Math.round(due.amount))])));
      setDueCategorySelections(
        Object.fromEntries(
          dues
            .filter((due) => Boolean(due.category_code))
            .map((due) => [dueKey(due), due.category_code])
        )
      );
      setOpenDueCategoryKey(null);
      setCategorySelections({});
      setOpenCategoryKey(null);
      setShowCategoryHelp(false);
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
            <View style={styles.summarySection}>
              <Text style={styles.recurringLabel}>{t(language, "topSpendCategories")}</Text>
              {topSpendCategories(importCoverage?.top_categories_overall ?? importCoverage?.top_categories_current_month ?? importSummary.top_categories).map(([category, amount]) => (
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

          {confirmableDetectedDues.length > 0 ? (
            <View style={styles.editorSection}>
              <Text style={styles.editorTitle}>Fix & Confirm Recurring Dues</Text>
              <Text style={styles.body}>Edit name, amount, and category. Confirm only the dues to protect.</Text>
              <View style={styles.duesList}>
                {confirmableDetectedDues.map((due) => {
                  const key = dueKey(due);
                  const selected = selectedDues[key] !== false;
                  const selectedCategory = dueCategorySelections[key] || due.category_code;
                  const expandedCategory = openDueCategoryKey === key;
                  const editedAmountText = dueAmounts[key] ?? String(Math.round(due.amount));
                  return (
                    <View key={key} style={styles.mappingCard}>
                      <View style={styles.dueHeaderRow}>
                        <Text style={styles.dueHeaderTitle}>{`Due ${dueDateFromEstimate(due.next_due_estimate)} · ${due.frequency}`}</Text>
                        <Pressable
                          onPress={() =>
                            setSelectedDues((current) => ({
                              ...current,
                              [key]: !selected
                            }))
                          }
                          style={[styles.includeChip, selected ? styles.includeChipOn : styles.includeChipOff]}
                        >
                          <Text style={[styles.includeChipText, selected ? styles.includeChipTextOn : styles.includeChipTextOff]}>
                            {selected ? "Included" : "Skipped"}
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.dueIdentityRow}>
                        <Text style={styles.dueIdentityText} numberOfLines={1} ellipsizeMode="tail">
                          {due.counterparty_name}
                        </Text>
                        <Text style={styles.dueIdentityAmount}>{formatMoney(due.amount)}</Text>
                      </View>
                      <TextInput
                        value={dueCustomNames[key] ?? due.counterparty_name}
                        onChangeText={(value) =>
                          setDueCustomNames((current) => ({
                            ...current,
                            [key]: value
                          }))
                        }
                        placeholder="Edit due name (shown on Home)"
                        placeholderTextColor={theme.colors.textMuted}
                        style={styles.dueEditInput}
                      />
                      <TextInput
                        keyboardType="numeric"
                        value={editedAmountText}
                        onChangeText={(value) =>
                          setDueAmounts((current) => ({
                            ...current,
                            [key]: value.replace(/[^\d.]/g, "")
                          }))
                        }
                        placeholder="Amount (e.g. 9330)"
                        placeholderTextColor={theme.colors.textMuted}
                        style={styles.dueAmountInput}
                      />
                      <Pressable
                        onPress={() =>
                          setOpenDueCategoryKey((current) => (current === key ? null : key))
                        }
                        style={[styles.mappingPicker, expandedCategory ? styles.mappingPickerOpen : null]}
                      >
                        <Text style={styles.mappingPickerText}>{categoryLabel(selectedCategory)}</Text>
                      </Pressable>
                      {expandedCategory ? (
                        <View style={styles.chipWrap}>
                          {CATEGORY_OPTIONS.map((option) => {
                            const catSelected = selectedCategory === option.code;
                            return (
                              <Pressable
                                key={`${key}:${option.code}`}
                                onPress={() => {
                                  setDueCategorySelections((current) => ({
                                    ...current,
                                    [key]: option.code
                                  }));
                                  setOpenDueCategoryKey(null);
                                }}
                                style={[styles.chip, catSelected ? styles.chipSelected : null]}
                              >
                                <Text style={[styles.chipText, catSelected ? styles.chipTextSelected : null]}>{option.label}</Text>
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
                label={confirming ? "Confirming..." : `Confirm Dues (${selectedCount})`}
                disabled={confirming || selectedCount === 0 || !uploadResult}
                onPress={async () => {
                  if (!userId || !uploadResult) {
                    return;
                  }
                  const confirmed: ConfirmDueItem[] = confirmableDetectedDues
                    .filter((due) => selectedDues[dueKey(due)] !== false)
                    .map((due) => {
                      const key = dueKey(due);
                      const parsedAmount = Number(dueAmounts[key]);
                      return {
                        counterparty_name: due.counterparty_name,
                        amount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : due.amount,
                        frequency: due.frequency,
                        next_due_date: dueDateFromEstimate(due.next_due_estimate),
                        custom_name: (dueCustomNames[key] ?? due.counterparty_name).trim() || due.counterparty_name,
                        category_code: dueCategorySelections[key] ?? due.category_code ?? null
                      };
                    });
                  try {
                    setConfirming(true);
                    await confirmDetectedDues(userId, uploadResult.upload_id, confirmed);
                    await refreshDashboard();
                    const confirmedKeys = new Set(
                      confirmableDetectedDues
                        .filter((due) => selectedDues[dueKey(due)] !== false)
                        .map((due) => dueKey(due))
                    );
                    setDetectedDues((current) => current.filter((due) => !confirmedKeys.has(dueKey(due))));
                    setSelectedDues({});
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
            <View style={styles.summarySection}>
              <Pressable
                onPress={() => setShowCategoryHelp((value) => !value)}
                style={[styles.mappingPicker, showCategoryHelp ? styles.mappingPickerOpen : null]}
              >
                <Text style={styles.mappingPickerText}>
                  {showCategoryHelp
                    ? "Hide category help"
                    : `Help categorize bigger spends (${categoryHelpCandidates.length})`}
                </Text>
              </Pressable>
              {showCategoryHelp ? (
                <>
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
                        setShowCategoryHelp(false);
                        await refreshDashboard();
                        Alert.alert("Saved", "Thanks. We will auto-map these next time.");
                      } catch (error) {
                        Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
                      } finally {
                        setSavingCategories(false);
                      }
                    }}
                  />
                </>
              ) : null}
            </View>
          ) : null}

          <Button label={t(language, "continueToHome")} onPress={() => router.replace("/(tabs)/home")} />
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
            <View style={styles.recurringSection}>
              <Text style={styles.recurringLabel}>{t(language, "recurringDuesFound")}</Text>
              <Text style={styles.body}>Confirm dues once. We will show them on Home as protected.</Text>
              <View style={styles.duesList}>
                {samplePendingDues.map((item) => {
                  const selected = selectedSampleDueKeys[item.due_key] !== false;
                  return (
                    <ChoiceCard
                      key={item.due_key}
                      title={`${item.name} · ${formatMoney(item.remaining_amount)}`}
                      subtitle={`due ${item.due_date}`}
                      icon="repeat-outline"
                      selected={selected}
                      onPress={() =>
                        setSelectedSampleDueKeys((current) => ({
                          ...current,
                          [item.due_key]: !selected
                        }))
                      }
                    />
                  );
                })}
              </View>
              <Button
                label={confirmingSampleDues ? "Confirming..." : `Confirm Dues (${selectedSampleCount})`}
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
                    await refreshDashboard();
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
          <Button label={t(language, "continueToHome")} onPress={() => router.replace("/(tabs)/home")} />
          <Button label={t(language, "startOver")} variant="secondary" onPress={() => resetFlow("choose")} />
        </View>
      ) : null}

      {loadingSample || uploading || confirming || confirmingSampleDues ? (
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
  editorSection: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: "#F7FCFA",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "#CFE8DF"
  },
  editorTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4
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
  dueHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  dueHeaderTitle: {
    flex: 1,
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  dueIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  dueIdentityText: {
    flex: 1,
    fontSize: theme.typography.body,
    fontWeight: "600",
    color: theme.colors.text
  },
  dueIdentityAmount: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  includeChip: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1
  },
  includeChipOn: {
    backgroundColor: "#EAF7F1",
    borderColor: "#7FB69A"
  },
  includeChipOff: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border
  },
  includeChipText: {
    fontSize: 12,
    fontWeight: "600"
  },
  includeChipTextOn: {
    color: "#186E4A"
  },
  includeChipTextOff: {
    color: theme.colors.textMuted
  },
  dueEditInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.caption,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceMuted
  },
  dueAmountInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.typography.caption,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceMuted
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
