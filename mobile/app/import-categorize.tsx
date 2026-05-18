import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { CATEGORY_OPTIONS, categoryLabel } from "../features/imports/categoryOptions";
import { getCategoryHelpCandidates, saveCategoryMappings } from "../services/api/moneyos";
import type { CategoryHelpCandidate, CategoryMappingItem } from "../services/api/types";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

function parseUploadIds(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ImportCategorizeScreen() {
  const params = useLocalSearchParams<{ upload_ids?: string }>();
  const uploadIds = useMemo(() => parseUploadIds(params.upload_ids), [params.upload_ids]);
  const userId = useSessionStore((state) => state.userId);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<CategoryHelpCandidate[]>([]);
  const [merchantLabels, setMerchantLabels] = useState<Record<string, string>>({});
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => candidates.filter((candidate) => Boolean(categorySelections[candidate.merchant_key])).length,
    [candidates, categorySelections]
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
        const result = await getCategoryHelpCandidates(activeUserId, uploadIds);
        if (!active) {
          return;
        }
        setCandidates(result);
        setMerchantLabels(
          Object.fromEntries(
            result.map((candidate) => [
              candidate.merchant_key,
              candidate.suggested_merchant_label || candidate.merchant_label
            ])
          )
        );
        setCategorySelections({});
        setOpenCategoryKey(null);
      } catch (error) {
        if (active) {
          Alert.alert("Could not load merchants", error instanceof Error ? error.message : "Please try again.");
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

  async function saveSelectedCategories() {
    if (!userId) {
      return;
    }
    const mappings: CategoryMappingItem[] = candidates
      .filter((candidate) => Boolean(categorySelections[candidate.merchant_key]))
      .map((candidate) => ({
        merchant_key: candidate.merchant_key,
        merchant_label: (merchantLabels[candidate.merchant_key] || candidate.merchant_label).trim() || candidate.merchant_label,
        category_code: categorySelections[candidate.merchant_key]
      }));
    if (!mappings.length) {
      return;
    }
    try {
      setSaving(true);
      await saveCategoryMappings(userId, mappings);
      await refreshDashboard({ includeSecondary: false, force: true });
      const savedKeys = new Set(mappings.map((item) => item.merchant_key));
      setCandidates((current) => current.filter((candidate) => !savedKeys.has(candidate.merchant_key)));
      setCategorySelections({});
      setOpenCategoryKey(null);
      Alert.alert("Saved", "These merchants will auto-map next time.");
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen title="Categorize merchants" subtitle="Confirm merchant names and categories once.">
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>Finding merchants...</Text>
        </View>
      ) : null}

      {!loading && candidates.length === 0 ? (
        <View style={[commonStyles.card, styles.card]}>
          <Text style={styles.title}>Nothing to categorize</Text>
          <Text style={styles.body}>New merchant questions will appear here after future imports.</Text>
        </View>
      ) : null}

      {candidates.map((candidate) => {
        const selectedCategory = categorySelections[candidate.merchant_key];
        const expanded = openCategoryKey === candidate.merchant_key;
        const hasSuggestion = Boolean(candidate.suggested_category_code);
        return (
          <View key={candidate.merchant_key} style={[commonStyles.card, styles.card]}>
            <View style={styles.keyBlock}>
              <Text style={styles.keyLabel}>Merchant key</Text>
              <Text style={styles.keyValue}>{candidate.merchant_key}</Text>
            </View>
            <TextInput
              value={merchantLabels[candidate.merchant_key] ?? candidate.merchant_label}
              onChangeText={(value) =>
                setMerchantLabels((current) => ({
                  ...current,
                  [candidate.merchant_key]: value
                }))
              }
              placeholder="Merchant name"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
            {hasSuggestion ? (
              <View style={styles.suggestionBox}>
                <Text style={styles.body}>
                  Seen before as {candidate.suggested_merchant_label || candidate.merchant_label} ·{" "}
                  {categoryLabel(candidate.suggested_category_code)}
                </Text>
                <Pressable
                  onPress={() => {
                    setMerchantLabels((current) => ({
                      ...current,
                      [candidate.merchant_key]: candidate.suggested_merchant_label || candidate.merchant_label
                    }));
                    setCategorySelections((current) => ({
                      ...current,
                      [candidate.merchant_key]: candidate.suggested_category_code || "uncategorized"
                    }));
                    setOpenCategoryKey(null);
                  }}
                  style={styles.confirmChip}
                >
                  <Text style={styles.confirmChipText}>Looks right</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              onPress={() => setOpenCategoryKey((current) => (current === candidate.merchant_key ? null : candidate.merchant_key))}
              style={[styles.picker, expanded ? styles.pickerOpen : null]}
            >
              <Text style={styles.pickerText}>{categoryLabel(selectedCategory)}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.chipWrap}>
                {CATEGORY_OPTIONS.map((option) => {
                  const active = selectedCategory === option.code;
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
        label={saving ? "Saving..." : `Save Categories (${selectedCount})`}
        disabled={saving || selectedCount === 0}
        onPress={saveSelectedCategories}
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  help: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
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
  keyBlock: {
    gap: 2
  },
  keyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase"
  },
  keyValue: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
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
  suggestionBox: {
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: "#F2FAF8",
    borderWidth: 1,
    borderColor: "#CFE8DF"
  },
  confirmChip: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: theme.colors.primary
  },
  confirmChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.white
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
