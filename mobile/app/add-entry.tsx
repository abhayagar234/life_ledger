import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import { createLedgerEntry } from "../services/api/moneyos";
import { useSessionStore } from "../store/session";
import type { LedgerEntryCreate } from "../services/api/types";
import { theme } from "../theme";

const entryOptions = [
  {
    key: "cash_set",
    title: "Cash In Hand",
    subtitle: "Tell us what cash is actually with you right now",
    icon: "wallet-outline"
  },
  {
    key: "cash_spent",
    title: "Big Cash Spent",
    subtitle: "Only add meaningful cash spend that the statement cannot see",
    icon: "remove-circle-outline"
  },
  {
    key: "cash_received",
    title: "Cash Received",
    subtitle: "Informal income, cash sale, or money collected outside the bank",
    icon: "add-circle-outline"
  },
  {
    key: "due_paid",
    title: "Due Paid",
    subtitle: "Mark EMI, bill, or rent as paid so the runway stays honest",
    icon: "receipt-outline"
  }
] as const;

type EntryOptionKey = (typeof entryOptions)[number]["key"];
type SourceOptionKey = "cash" | "online" | "card" | "split";

const sourceOptions: Array<{
  value: SourceOptionKey;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  { value: "cash", title: "Cash", subtitle: "Money moved in cash", icon: "wallet-outline" },
  { value: "online", title: "Online / UPI", subtitle: "Money moved from bank, UPI, or account balance", icon: "phone-portrait-outline" },
  { value: "split", title: "Cash + Online / UPI", subtitle: "Part cash, part online", icon: "git-merge-outline" },
  { value: "card", title: "Credit Card", subtitle: "Money moved on a credit card", icon: "card-outline" }
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildPayload(option: EntryOptionKey, amount: number, note: string, source: Exclude<SourceOptionKey, "split">): LedgerEntryCreate {
  if (option === "cash_set") {
    return {
      entry_type: "cash_adjustment",
      amount,
      entry_date: todayIso(),
      account_type: "cash",
      cash_direction: "set",
      description: note || "Manual cash in hand update",
      source_label: "mobile_quick_cash"
    };
  }

  if (option === "cash_received") {
    return {
      entry_type: "income",
      amount,
      entry_date: todayIso(),
      account_type: source === "online" ? "bank" : "cash",
      cash_direction: "in",
      description: note || (source === "online" ? "Manual online or UPI money received" : "Manual cash received"),
      source_label: source === "online" ? "mobile_quick_bank" : "mobile_quick_cash"
    };
  }

  if (option === "due_paid") {
    return {
      entry_type: "emi_payment",
      amount,
      entry_date: todayIso(),
      account_type: source === "online" ? "bank" : "cash",
      cash_direction: "out",
      category_code: "bills",
      description: note || (source === "online" ? "Manual due paid from bank or UPI" : "Manual due paid in cash"),
      source_label: source === "online" ? "mobile_quick_bank" : "mobile_quick_cash"
    };
  }

  return {
    entry_type: "expense",
    amount,
    entry_date: todayIso(),
    account_type: source === "online" ? "bank" : source === "card" ? "card" : "cash",
    cash_direction: "out",
    description:
      note ||
      (source === "online"
        ? "Manual online or UPI spend"
        : source === "card"
          ? "Manual credit card spend"
          : "Manual cash spent"),
    source_label:
      source === "online" ? "mobile_quick_bank" : source === "card" ? "mobile_quick_card" : "mobile_quick_cash"
  };
}

function buildPayloads(
  option: EntryOptionKey,
  amount: number,
  note: string,
  source: SourceOptionKey,
  splitCashAmount: number
): LedgerEntryCreate[] {
  if (source !== "split") {
    return [buildPayload(option, amount, note, source)];
  }

  const onlineAmount = Math.max(amount - splitCashAmount, 0);
  const payloads: LedgerEntryCreate[] = [];
  if (splitCashAmount > 0) {
    payloads.push(buildPayload(option, splitCashAmount, note, "cash"));
  }
  if (onlineAmount > 0) {
    payloads.push(buildPayload(option, onlineAmount, note, "online"));
  }
  return payloads;
}

export default function AddEntryScreen() {
  const userId = useSessionStore((state) => state.userId);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const currentCashOnHand = useSessionStore((state) => state.dashboard.cashflowSummary?.cash_on_hand ?? 0);
  const [selected, setSelected] = useState<EntryOptionKey>("cash_set");
  const [source, setSource] = useState<SourceOptionKey>("cash");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedOption = useMemo(() => entryOptions.find((option) => option.key === selected) ?? entryOptions[0], [selected]);
  const availableSourceOptions = useMemo(() => {
    if (selected === "cash_spent") {
      return sourceOptions;
    }
    if (selected === "cash_received" || selected === "due_paid") {
      return sourceOptions.filter((option) => option.value !== "card");
    }
    return [];
  }, [selected]);

  useEffect(() => {
    if (!availableSourceOptions.length) {
      return;
    }
    if (!availableSourceOptions.some((option) => option.value === source)) {
      setSource(availableSourceOptions[0].value);
    }
  }, [availableSourceOptions, source]);

  const helperText = useMemo(() => {
    if (selected === "cash_set") {
      return "Use this when you want to reset the app to the real cash amount with you now.";
    }
    if (selected === "cash_spent") {
      if (source === "online") {
        return "Use this when a meaningful online or UPI spend happened and the statement has not caught up yet.";
      }
      if (source === "split") {
        return "Use this when part of the payment went in cash and the rest went online or through UPI.";
      }
      if (source === "card") {
        return "Use this when a meaningful credit card spend happened so we can protect that due later.";
      }
      return "Use this when a meaningful cash spend happened outside what the statement can see.";
    }
    if (selected === "cash_received") {
      return source === "online"
        ? "Use this for money received into bank or UPI that you want reflected before the next import."
        : "Good for informal income, cash collections, or money received outside the bank.";
    }
    if (source === "split") {
      return "Use this when a due was paid partly in cash and partly online, so both buckets stay honest.";
    }
    return source === "online"
      ? "This keeps dues honest after you already paid them from bank or UPI."
      : "This keeps dues honest after you already paid them in cash.";
  }, [selected, source]);

  return (
    <AppScreen title="Update Cash and Dues" subtitle="Import is the backbone. These quick updates fill the missing cash and paid-due details.">
      {entryOptions.map((option) => (
        <ChoiceCard
          key={option.key}
          title={option.title}
          subtitle={option.subtitle}
          icon={option.icon}
          selected={selected === option.key}
          onPress={() => setSelected(option.key)}
        />
      ))}

      <View style={styles.form}>
        {selected !== "cash_set" ? (
          <View style={styles.field}>
            <Text style={styles.label}>Where did this money move?</Text>
            {availableSourceOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                title={option.title}
                subtitle={option.subtitle}
                icon={option.icon}
                selected={source === option.value}
                onPress={() => setSource(option.value)}
              />
            ))}
          </View>
        ) : null}

        {source === "split" ? (
          <View style={styles.field}>
            <Text style={styles.label}>How much was paid in cash?</Text>
            <TextInput
              keyboardType="numeric"
              value={splitCashAmount}
              onChangeText={setSplitCashAmount}
              placeholder={`Cash available now: Rs ${Math.max(Math.round(currentCashOnHand), 0).toLocaleString("en-IN")}`}
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.noteText}>
              The rest will be treated as online / UPI automatically.
            </Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>{selectedOption.title}</Text>
          <TextInput
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="Example: 1500"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Short note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional: school fees, mandi sale, wallet cash"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
        </View>

        <Text style={styles.noteText}>{helperText}</Text>
        {(selected === "cash_spent" || selected === "due_paid") && source !== "online" && source !== "card" ? (
          <Text style={styles.noteText}>{`Cash on hand right now: Rs ${Math.round(currentCashOnHand).toLocaleString("en-IN")}`}</Text>
        ) : null}
      </View>

      <Button
        label={saving ? "Saving..." : "Save And Refresh"}
        disabled={saving || !amount.trim()}
        onPress={async () => {
          if (!userId) {
            Alert.alert("Missing session", "Please go back and reload the app once.");
            return;
          }

          const numericAmount = Number(amount);
          if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            Alert.alert("Enter an amount", "Please add a valid amount bigger than zero.");
            return;
          }

          const numericSplitCashAmount = splitCashAmount.trim() ? Number(splitCashAmount) : 0;
          if (source === "split") {
            if (!Number.isFinite(numericSplitCashAmount) || numericSplitCashAmount <= 0) {
              Alert.alert("Enter cash amount", "Tell us how much of this payment went in cash.");
              return;
            }
            if (numericSplitCashAmount >= numericAmount) {
              Alert.alert("Use cash only instead", "If the full amount was paid in cash, choose Cash instead of split.");
              return;
            }
            if (numericSplitCashAmount > currentCashOnHand) {
              Alert.alert("Cash is short", "The cash part is more than your cash on hand. Lower the cash part or choose Online / UPI.");
              return;
            }
          }

          if ((selected === "cash_spent" || selected === "due_paid") && source === "cash" && numericAmount > currentCashOnHand) {
            Alert.alert(
              "Cash is short",
              "This amount is more than your current cash on hand. Choose Cash + Online / UPI if the payment was split, or choose Online / UPI."
            );
            return;
          }

          setSaving(true);
          try {
            const payloads = buildPayloads(selected, numericAmount, note.trim(), source, numericSplitCashAmount);
            for (const payload of payloads) {
              await createLedgerEntry(userId, payload);
            }
            await refreshDashboard();
            Alert.alert("Updated", "Your cashflow answer has been refreshed.");
            router.back();
          } catch (error) {
            Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
          } finally {
            setSaving(false);
          }
        }}
      />

      {saving ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>Saving the update and rebuilding your safe-till-date answer.</Text>
        </View>
      ) : null}

      <Button label="Back To Home" variant="secondary" onPress={() => router.back()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.md
  },
  field: {
    gap: theme.spacing.sm
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.lg,
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
