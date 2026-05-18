import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  dueDateFromEstimate,
  dueKey,
  formatMoney
} from "../features/imports/categoryOptions";
import { confirmDetectedDues, getRecurringDues } from "../services/api/moneyos";
import type { ConfirmDueItem, DetectedDueResponse } from "../services/api/types";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

function parseUploadIds(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ImportRecurringDuesScreen() {
  const params = useLocalSearchParams<{ upload_ids?: string }>();
  const uploadIds = useMemo(() => parseUploadIds(params.upload_ids), [params.upload_ids]);
  const userId = useSessionStore((state) => state.userId);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);

  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dues, setDues] = useState<DetectedDueResponse[]>([]);
  const [selectedDues, setSelectedDues] = useState<Record<string, boolean>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);

  const confirmableDues = useMemo(
    () => dues.filter((due) => due.frequency === "weekly" || due.frequency === "monthly"),
    [dues]
  );
  const selectedCount = useMemo(
    () => confirmableDues.filter((due) => selectedDues[dueKey(due)] !== false).length,
    [confirmableDues, selectedDues]
  );

  useEffect(() => {
    if (!userId || uploadIds.length === 0) {
      return;
    }
    const activeUserId = userId;
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const result = await getRecurringDues(activeUserId, uploadIds);
        if (!active) {
          return;
        }
        setDues(result);
        setSelectedDues(Object.fromEntries(result.map((due) => [dueKey(due), true])));
        setCustomNames(Object.fromEntries(result.map((due) => [dueKey(due), due.counterparty_name])));
        setAmounts(Object.fromEntries(result.map((due) => [dueKey(due), String(Math.round(due.amount))])));
        setCategorySelections(
          Object.fromEntries(
            result
              .filter((due) => Boolean(due.category_code))
              .map((due) => [dueKey(due), due.category_code])
          )
        );
      } catch (error) {
        if (active) {
          Alert.alert("Could not load dues", error instanceof Error ? error.message : "Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [userId, uploadIds]);

  async function confirmSelectedDues() {
    if (!userId || uploadIds.length === 0) {
      return;
    }
    const confirmed: ConfirmDueItem[] = confirmableDues
      .filter((due) => selectedDues[dueKey(due)] !== false)
      .map((due) => {
        const key = dueKey(due);
        const parsedAmount = Number(amounts[key]);
        return {
          counterparty_name: due.counterparty_name,
          amount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : due.amount,
          frequency: due.frequency,
          next_due_date: dueDateFromEstimate(due.next_due_estimate),
          custom_name: (customNames[key] ?? due.counterparty_name).trim() || due.counterparty_name,
          category_code: categorySelections[key] ?? due.category_code ?? null
        };
      });
    if (!confirmed.length) {
      return;
    }
    try {
      setConfirming(true);
      await confirmDetectedDues(userId, uploadIds[uploadIds.length - 1], confirmed);
      await refreshDashboard({ includeSecondary: false, force: true });
      const confirmedKeys = new Set(
        confirmableDues
          .filter((due) => selectedDues[dueKey(due)] !== false)
          .map((due) => dueKey(due))
      );
      setDues((current) => current.filter((due) => !confirmedKeys.has(dueKey(due))));
      setSelectedDues({});
      Alert.alert("Done", "Recurring dues confirmed.");
    } catch (error) {
      Alert.alert("Could not confirm dues", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <AppScreen title="Fix recurring dues" subtitle="Confirm the payments that should be protected on Home.">
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>Finding recurring dues...</Text>
        </View>
      ) : null}

      {!loading && confirmableDues.length === 0 ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>No recurring dues found</Text>
          <Text style={styles.body}>You can continue or come back after importing more statements.</Text>
        </View>
      ) : null}

      {confirmableDues.map((due) => {
        const key = dueKey(due);
        const selected = selectedDues[key] !== false;
        const selectedCategory = categorySelections[key] || due.category_code;
        const expandedCategory = openCategoryKey === key;
        return (
          <View key={key} style={[commonStyles.card, styles.card, selected ? styles.selectedCard : null]}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{customNames[key] || due.counterparty_name}</Text>
                <Text style={styles.body}>{`${due.frequency === "weekly" ? "Weekly" : "Monthly"} pattern from your statement`}</Text>
              </View>
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
            <Text style={styles.amountLabel}>{`Usual amount ${formatMoney(due.amount)}`}</Text>
            <TextInput
              value={customNames[key] ?? due.counterparty_name}
              onChangeText={(value) =>
                setCustomNames((current) => ({
                  ...current,
                  [key]: value
                }))
              }
              placeholder="Name"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
            <TextInput
              keyboardType="numeric"
              value={amounts[key] ?? String(Math.round(due.amount))}
              onChangeText={(value) =>
                setAmounts((current) => ({
                  ...current,
                  [key]: value.replace(/[^\d.]/g, "")
                }))
              }
              placeholder="Amount"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
            <Pressable
              onPress={() => setOpenCategoryKey((current) => (current === key ? null : key))}
              style={[styles.picker, expandedCategory ? styles.pickerOpen : null]}
            >
              <Text style={styles.pickerText}>{categoryLabel(selectedCategory)}</Text>
            </Pressable>
            {expandedCategory ? (
              <View style={styles.chipWrap}>
                {CATEGORY_OPTIONS.map((option) => {
                  const active = selectedCategory === option.code;
                  return (
                    <Pressable
                      key={`${key}:${option.code}`}
                      onPress={() => {
                        setCategorySelections((current) => ({
                          ...current,
                          [key]: option.code
                        }));
                        setOpenCategoryKey(null);
                      }}
                      style={[styles.chip, active ? styles.chipSelected : null]}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextSelected : null]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <Button
        label={confirming ? "Confirming..." : `Confirm Dues (${selectedCount})`}
        disabled={confirming || selectedCount === 0}
        onPress={confirmSelectedDues}
      />
      <Button label="Back to summary" variant="secondary" onPress={() => router.back()} />
      <Button label="Continue Home" variant="ghost" onPress={() => router.replace("/(tabs)/home")} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm
  },
  selectedCard: {
    borderColor: theme.colors.primary
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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  headerText: {
    flex: 1,
    gap: 3
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
  amountLabel: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.primary
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceMuted
  },
  picker: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted
  },
  pickerOpen: {
    borderColor: theme.colors.primary
  },
  pickerText: {
    fontSize: theme.typography.body,
    color: theme.colors.text
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
    fontWeight: "700"
  },
  includeChipTextOn: {
    color: "#186E4A"
  },
  includeChipTextOff: {
    color: theme.colors.textMuted
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingVertical: 7,
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
