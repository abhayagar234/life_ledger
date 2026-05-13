import { File } from "expo-file-system";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import { loadSampleStatement, uploadImportFile, getDetectedDues, confirmDetectedDues } from "../services/api/moneyos";
import type { ConfirmDueItem, DetectedDueResponse, FileUploadResponse } from "../services/api/types";
import { t } from "../i18n";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

function formatMoney(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
}

function dueDateFromEstimate(value?: string | null) {
  if (value) {
    return value;
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function ImportStatementScreen() {
  const userId = useSessionStore((state) => state.userId);
  const profile = useSessionStore((state) => state.profile);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const [loadingSample, setLoadingSample] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadResult, setUploadResult] = useState<FileUploadResponse | null>(null);
  const [detectedDues, setDetectedDues] = useState<DetectedDueResponse[]>([]);
  const [selectedDues, setSelectedDues] = useState<Record<string, boolean>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  const selectedCount = useMemo(
    () =>
      detectedDues.filter(
        (due) =>
          selectedDues[due.counterparty_name] !== false &&
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
              const pickedResult = await File.pickFileAsync(undefined, "public.data");
              const picked = Array.isArray(pickedResult) ? pickedResult[0] : pickedResult;
              if (!picked) {
                throw new Error("No file selected.");
              }
              const pickedFile = picked as any;
              const mimeType =
                pickedFile.extension === ".pdf"
                  ? "application/pdf"
                  : pickedFile.extension === ".csv"
                    ? "text/csv"
                    : "application/octet-stream";
              const result = await uploadImportFile(userId, {
                uri: pickedFile.uri,
                name: pickedFile.name,
                mimeType
              });
              const dues = await getDetectedDues(userId, result.upload_id);
              setUploadResult(result);
              setDetectedDues(dues);
              setSelectedDues(Object.fromEntries(dues.map((due) => [due.counterparty_name, true])));
              setCustomNames(Object.fromEntries(dues.map((due) => [due.counterparty_name, due.counterparty_name])));
              await refreshDashboard();
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

      {uploadResult ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "importedTitle")}</Text>
          <Text style={styles.body}>{uploadResult.file_name}</Text>
          <Text style={styles.body}>
            {uploadResult.imported_rows} rows imported · {uploadResult.duplicate_rows} duplicates
          </Text>
        </View>
      ) : null}

      {uploadResult?.preview?.length ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>Preview</Text>
          {uploadResult.preview.slice(0, 5).map((row, index) => (
            <Text key={`${row.transaction_date}-${index}`} style={styles.body}>
              {row.transaction_date} · {row.direction} · {formatMoney(row.amount)} · {row.description_clean}
            </Text>
          ))}
        </View>
      ) : null}

      {detectedDues.length ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>{t(language, "recurringDuesFound")}</Text>
          <Text style={styles.body}>{t(language, "recurringDuesBody")}</Text>
          <ScrollView style={styles.duesList}>
            {detectedDues.map((due) => {
              const selected = selectedDues[due.counterparty_name] !== false;
              const confirmable = due.frequency === "weekly" || due.frequency === "monthly";
              return (
                <View key={due.counterparty_name} style={styles.dueWrap}>
                  <ChoiceCard
                    title={`${due.counterparty_name} · ${formatMoney(due.amount)}`}
                    subtitle={`${due.frequency} · confidence ${Math.round(due.confidence * 100)}%${confirmable ? "" : " · review only"}`}
                    icon="repeat-outline"
                    selected={selected && confirmable}
                    onPress={() =>
                      confirmable
                        ? setSelectedDues((current) => ({
                            ...current,
                            [due.counterparty_name]: !selected
                          }))
                        : undefined
                    }
                  />
                  {!confirmable ? <Text style={styles.noteText}>{t(language, "irregularReviewNote")}</Text> : null}
                  {selected ? (
                    <TextInput
                      value={customNames[due.counterparty_name] ?? due.counterparty_name}
                      onChangeText={(value) =>
                        setCustomNames((current) => ({
                          ...current,
                          [due.counterparty_name]: value
                        }))
                      }
                      placeholder={t(language, "renameIfNeeded")}
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.input}
                    />
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
                    selectedDues[due.counterparty_name] !== false &&
                    (due.frequency === "weekly" || due.frequency === "monthly")
                )
                .map((due) => ({
                  counterparty_name: due.counterparty_name,
                  amount: due.amount,
                  frequency: due.frequency,
                  next_due_date: dueDateFromEstimate(due.next_due_estimate),
                  custom_name: customNames[due.counterparty_name] || due.counterparty_name
                }));

              try {
                setConfirming(true);
                const result = await confirmDetectedDues(userId, uploadResult.upload_id, confirmed);
                await refreshDashboard();
                Alert.alert("Dues confirmed", result.message);
                router.replace("/(tabs)/home");
              } catch (error) {
                Alert.alert("Could not confirm dues", error instanceof Error ? error.message : "Please try again.");
              } finally {
                setConfirming(false);
              }
            }}
          />
        </View>
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
  }
});
