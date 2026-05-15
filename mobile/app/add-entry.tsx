import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import { t } from "../i18n";
import { createLedgerEntry, createUpcomingDue } from "../services/api/moneyos";
import { useSessionStore } from "../store/session";
import type { LedgerEntryCreate } from "../services/api/types";
import { theme } from "../theme";

const entryOptions = [
  {
    key: "cash_set",
    title: "Set Cash On Hand",
    subtitle: "Reset cash to what is actually with you right now",
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
  }
] as const;

const duePaidOption = {
  key: "due_paid",
  title: "Due Paid",
  subtitle: "Mark EMI, bill, or rent as paid so the runway stays honest",
  icon: "receipt-outline"
} as const;

const dayTotalOption = {
  key: "cash_day_total",
  title: "Today's Cash Total",
  subtitle: "One total for the day instead of many tiny cash entries",
  icon: "calculator-outline"
} as const;

const businessEntryOptions = [
  {
    key: "business_customer_payment",
    title: "Customer Payment Received",
    subtitle: "Money came in from a customer, sale, or service",
    icon: "cash-outline"
  },
  {
    key: "business_supplier_expense",
    title: "Supplier Expense",
    subtitle: "Stock, supplier, or shop-running payment",
    icon: "cube-outline"
  },
  {
    key: "business_cash_expense",
    title: "Business Cash Expense",
    subtitle: "Daily business spend paid outside what statements can see",
    icon: "briefcase-outline"
  }
] as const;

type EntryOptionKey =
  | (typeof entryOptions)[number]["key"]
  | (typeof businessEntryOptions)[number]["key"]
  | typeof duePaidOption.key
  | typeof dayTotalOption.key;
type SourceOptionKey = "cash" | "online" | "card" | "split";
type DuePaymentChoice = "full" | "minimum";
type MoneyScope = "home" | "business" | "mixed";

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

function offsetDateIso(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function isCreditCardDueName(name?: string) {
  if (!name) {
    return false;
  }
  return /(credit|card|\bcc\b)/i.test(name);
}

function formatEditableAmount(amount: number | null) {
  if (!amount || !Number.isFinite(amount)) {
    return "";
  }
  return String(Math.round(amount * 100) / 100);
}

function formatMoney(amount: number | null | undefined) {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;
  return `Rs ${Math.round(safeAmount).toLocaleString("en-IN")}`;
}

type DuePrefill = {
  dueName?: string;
  emiPaymentId?: string;
  dueKey?: string;
};

function buildPayload(
  option: EntryOptionKey,
  amount: number,
  note: string,
  source: Exclude<SourceOptionKey, "split">,
  moneyScope: MoneyScope,
  duePrefill?: DuePrefill
): LedgerEntryCreate {
  const isBusinessScope = moneyScope === "business" || moneyScope === "mixed";
  if (option === "cash_set") {
    return {
      entry_type: "cash_adjustment",
      amount,
      entry_date: todayIso(),
      account_type: "cash",
      cash_direction: "set",
      description: note || "Manual cash in hand update",
      source_label: "mobile_quick_cash",
      is_business: isBusinessScope,
      money_scope: moneyScope
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
      source_label: source === "online" ? "mobile_quick_bank" : "mobile_quick_cash",
      is_business: isBusinessScope,
      money_scope: moneyScope
    };
  }

  if (option === "business_customer_payment") {
    return {
      entry_type: "income",
      amount,
      entry_date: todayIso(),
      account_type: source === "online" ? "bank" : "cash",
      cash_direction: "in",
      category_code: "business_income",
      description: note || (source === "online" ? "Customer payment received in bank or UPI" : "Customer payment received in cash"),
      source_label: source === "online" ? "business_customer_bank" : "business_customer_cash",
      is_business: true,
      money_scope: moneyScope
    };
  }

  if (option === "business_supplier_expense" || option === "business_cash_expense") {
    const descriptionByOption = {
      business_supplier_expense: source === "online" ? "Supplier or stock expense paid from bank or UPI" : "Supplier or stock expense paid in cash",
      business_cash_expense: source === "online" ? "Business running expense paid from bank or UPI" : "Business running expense paid in cash"
    } as const;
    const sourceLabelByOption = {
      business_supplier_expense: source === "online" ? "business_supplier_bank" : "business_supplier_cash",
      business_cash_expense: source === "online" ? "business_expense_bank" : "business_expense_cash"
    } as const;
    return {
      entry_type: "expense",
      amount,
      entry_date: todayIso(),
      account_type: source === "online" ? "bank" : "cash",
      cash_direction: "out",
      category_code: "business_expense",
      description: note || descriptionByOption[option],
      source_label: sourceLabelByOption[option],
      is_business: true,
      money_scope: moneyScope
    };
  }

  if (option === "cash_day_total") {
    return {
      entry_type: "expense",
      amount,
      entry_date: todayIso(),
      account_type: "cash",
      cash_direction: "out",
      description: note || "Daily cash total",
      source_label: "daily_cash_total",
      is_business: isBusinessScope,
      money_scope: moneyScope
    };
  }

  if (option === "due_paid") {
    return {
      entry_type: "emi_payment",
      amount,
      entry_date: todayIso(),
      account_type: source === "online" ? "bank" : "cash",
      cash_direction: "out",
      counterparty_name: duePrefill?.dueName ?? null,
      category_code: "bills",
      description: note || (source === "online" ? "Manual due paid from bank or UPI" : "Manual due paid in cash"),
      source_label: duePrefill?.emiPaymentId
        ? source === "online"
          ? "mobile_quick_bank"
          : "mobile_quick_cash"
        : duePrefill?.dueKey ?? (source === "online" ? "mobile_quick_bank" : "mobile_quick_cash"),
      emi_payment_id: duePrefill?.emiPaymentId ?? null,
      is_business: isBusinessScope,
      money_scope: moneyScope
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
      source === "online" ? "mobile_quick_bank" : source === "card" ? "mobile_quick_card" : "mobile_quick_cash",
    is_business: isBusinessScope,
    money_scope: moneyScope
  };
}

function buildPayloads(
  option: EntryOptionKey,
  amount: number,
  note: string,
  source: SourceOptionKey,
  splitCashAmount: number,
  moneyScope: MoneyScope,
  duePrefill?: DuePrefill
): LedgerEntryCreate[] {
  if (source !== "split") {
    return [buildPayload(option, amount, note, source, moneyScope, duePrefill)];
  }

  const onlineAmount = Math.max(amount - splitCashAmount, 0);
  const payloads: LedgerEntryCreate[] = [];
  if (splitCashAmount > 0) {
    payloads.push(buildPayload(option, splitCashAmount, note, "cash", moneyScope, duePrefill));
  }
  if (onlineAmount > 0) {
    payloads.push(buildPayload(option, onlineAmount, note, "online", moneyScope, duePrefill));
  }
  return payloads;
}

export default function AddEntryScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    amount?: string;
    note?: string;
    dueName?: string;
    dueKey?: string;
    emiPaymentId?: string;
    recurringDue?: string;
  }>();
  const userId = useSessionStore((state) => state.userId);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const markHasRealData = useSessionStore((state) => state.markHasRealData);
  const currentCashOnHand = useSessionStore((state) => state.dashboard.cashflowSummary?.cash_on_hand ?? 0);
  const currentWorkingBankBalance = useSessionStore(
    (state) => state.dashboard.cashflowSummary?.working_bank_balance ?? 0
  );
  const profile = useSessionStore((state) => state.profile);
  const isBusinessUser = profile?.user_type === "business_self_employed" || profile?.receives_salary_besides_business;
  const initialMode =
    params.mode === "cash_received" ||
    params.mode === "cash_spent" ||
    params.mode === "cash_day_total" ||
    params.mode === "due_paid" ||
    params.mode === "business_customer_payment" ||
    params.mode === "business_supplier_expense" ||
    params.mode === "business_cash_expense" ||
    params.mode === "cash_set"
      ? params.mode
      : "cash_set";
  const [selected, setSelected] = useState<EntryOptionKey>(initialMode);
  const [source, setSource] = useState<SourceOptionKey>("cash");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [amount, setAmount] = useState(typeof params.amount === "string" ? params.amount : "");
  const [duePaymentChoice, setDuePaymentChoice] = useState<DuePaymentChoice>("full");
  const [minimumAmount, setMinimumAmount] = useState("");
  const [moneyScope, setMoneyScope] = useState<MoneyScope>("home");
  const [isBorrowedMoney, setIsBorrowedMoney] = useState(false);
  const [borrowedDueDate, setBorrowedDueDate] = useState(offsetDateIso(30));
  const [note, setNote] = useState(typeof params.note === "string" ? params.note : "");
  const [saving, setSaving] = useState(false);
  const duePrefill = useMemo(
    () => ({
      dueName: typeof params.dueName === "string" ? params.dueName : undefined,
      emiPaymentId: typeof params.emiPaymentId === "string" ? params.emiPaymentId : undefined,
      dueKey: typeof params.dueKey === "string" ? params.dueKey : undefined
    }),
    [params.dueKey, params.dueName, params.emiPaymentId]
  );

  const visibleEntryOptions = useMemo(
    () => {
      if (duePrefill.dueName) {
        return [...entryOptions, duePaidOption];
      }
      if (
        selected === "business_customer_payment" ||
        selected === "business_supplier_expense" ||
        selected === "business_cash_expense"
      ) {
        return businessEntryOptions;
      }
      if (selected === "cash_day_total") {
        return [dayTotalOption];
      }
      return entryOptions;
    },
    [duePrefill.dueName, selected]
  );

  const selectedOption = useMemo(
    () => visibleEntryOptions.find((option) => option.key === selected) ?? visibleEntryOptions[0],
    [selected, visibleEntryOptions]
  );
  const fullDueAmount = useMemo(() => {
    const parsed = Number(params.amount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params.amount]);
  const isCreditCardDue = selected === "due_paid" && isCreditCardDueName(duePrefill.dueName);
  const shouldShowMoneyScope = profile?.user_type === "business_self_employed" || profile?.receives_salary_besides_business;
  const suggestedMinimumAmount = useMemo(() => {
    if (!fullDueAmount) {
      return null;
    }
    return Math.max(Math.round(fullDueAmount * 0.03), 1);
  }, [fullDueAmount]);
  const availableSourceOptions = useMemo(() => {
    if (selected === "business_customer_payment") {
      return sourceOptions.filter((option) => option.value !== "card");
    }
    if (
      selected === "business_supplier_expense" ||
      selected === "business_cash_expense"
    ) {
      return sourceOptions.filter((option) => option.value !== "card");
    }
    if (selected === "cash_spent") {
      return sourceOptions;
    }
    if (selected === "cash_day_total") {
      return [];
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

  useEffect(() => {
    if (
      params.mode === "cash_received" ||
      params.mode === "cash_spent" ||
      params.mode === "cash_day_total" ||
      params.mode === "due_paid" ||
      params.mode === "business_customer_payment" ||
      params.mode === "business_supplier_expense" ||
      params.mode === "business_cash_expense" ||
      params.mode === "cash_set"
    ) {
      setSelected(params.mode);
    }
  }, [params.mode]);

  useEffect(() => {
    // Prevent stale amount/source state from carrying across different entry intents.
    if (selected === "cash_set") {
      setSource("cash");
      setSplitCashAmount("");
      setIsBorrowedMoney(false);
      return;
    }
    if (selected === "cash_day_total") {
      setSource("cash");
      setSplitCashAmount("");
      setIsBorrowedMoney(false);
      return;
    }
    setAmount("");
    setSplitCashAmount("");
    setMinimumAmount("");
    setIsBorrowedMoney(false);
    if (selected === "cash_received" || selected === "business_customer_payment") {
      setSource("cash");
      return;
    }
    setSource("cash");
  }, [selected]);

  useEffect(() => {
    if (!shouldShowMoneyScope) {
      setMoneyScope("home");
      return;
    }
    setMoneyScope(profile?.money_mix_type === "business" || profile?.money_mix_type === "mixed" ? profile.money_mix_type : "home");
  }, [profile?.money_mix_type, shouldShowMoneyScope]);

  useEffect(() => {
    if (!isCreditCardDue || !suggestedMinimumAmount || minimumAmount.trim()) {
      return;
    }
    const defaultMinimum = String(suggestedMinimumAmount);
    setMinimumAmount(defaultMinimum);
    if (duePaymentChoice === "minimum") {
      setAmount(defaultMinimum);
    }
  }, [duePaymentChoice, isCreditCardDue, minimumAmount, suggestedMinimumAmount]);

  useEffect(() => {
    if (!isCreditCardDue || !fullDueAmount) {
      return;
    }
    if (duePaymentChoice === "full") {
      setAmount(formatEditableAmount(fullDueAmount));
      return;
    }
    setAmount(minimumAmount);
  }, [duePaymentChoice, fullDueAmount, isCreditCardDue, minimumAmount]);

  const helperText = useMemo(() => {
    if (selected === "cash_set") {
      return "Use this when you want to reset the app to the real cash amount with you now. If new money came in, use Cash Received instead.";
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
    if (selected === "cash_day_total") {
      return "Use this once at the end of the day when you just want one honest cash number instead of logging every small tea, travel, or kirana payment.";
    }
    if (selected === "cash_received") {
      if (isBorrowedMoney) {
        return "This money comes in now, but we will also keep the return date visible so safe-to-spend does not get inflated.";
      }
      return source === "online"
        ? "Use this for money received into bank or UPI that you want reflected before the next import."
        : "Good for informal income, cash collections, or money received outside the bank.";
    }
    if (selected === "business_customer_payment") {
      return source === "online"
        ? "Use this when a customer paid into bank or UPI and you want business money visible now."
        : "Use this when customer money came in cash and you want the business side updated now.";
    }
    if (selected === "business_supplier_expense") {
      return source === "split"
        ? "Use this when stock or supplier money went partly in cash and partly online."
        : "Use this when supplier, stock, or running costs have already gone out and should reduce the business side now.";
    }
    if (selected === "business_cash_expense") {
      return source === "split"
        ? "Use this when a business expense was split between cash and online."
        : "Use this for daily shop, clinic, salon, tuition, or service running costs outside what the statement can see yet.";
    }
    if (selected === "due_paid" && isCreditCardDue) {
      return duePaymentChoice === "minimum"
        ? "Minimum payment keeps the rest of the card balance visible, so the app does not overstate free money."
        : "Full payment clears the whole card due from protection for this cycle.";
    }
    if (duePrefill.dueName) {
      return `Mark ${duePrefill.dueName} as paid so it moves out of pending dues and the safe-to-spend answer updates honestly.`;
    }
    if (source === "split") {
      return "Use this when a due was paid partly in cash and partly online, so both buckets stay honest.";
    }
    return source === "online"
      ? "This keeps dues honest after you already paid them from bank or UPI."
      : "This keeps dues honest after you already paid them in cash.";
  }, [duePaymentChoice, duePrefill.dueName, isBorrowedMoney, isCreditCardDue, selected, source]);

  return (
    <AppScreen title={t(language, "updateCashDues")} subtitle={t(language, "updateCashDuesSubtitle")}>
      {visibleEntryOptions.map((option) => (
        <ChoiceCard
          key={option.key}
          title={option.title}
          subtitle={option.subtitle}
          icon={option.icon}
          selected={selected === option.key}
          onPress={() => setSelected(option.key as EntryOptionKey)}
        />
      ))}

      <View style={styles.form}>
        {selected !== "cash_set" && selected !== "cash_day_total" ? (
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

        {shouldShowMoneyScope ? (
          <View style={styles.field}>
            <Text style={styles.label}>{t(language, "moneyMixQuestion")}</Text>
            <ChoiceCard
              title={t(language, "scopeHome")}
              subtitle={t(language, "scopeHomeHint")}
              icon="home-outline"
              selected={moneyScope === "home"}
              onPress={() => setMoneyScope("home")}
            />
            <ChoiceCard
              title={t(language, "scopeBusiness")}
              subtitle={t(language, "scopeBusinessHint")}
              icon="storefront-outline"
              selected={moneyScope === "business"}
              onPress={() => setMoneyScope("business")}
            />
            <ChoiceCard
              title={t(language, "scopeMixed")}
              subtitle={t(language, "scopeMixedHint")}
              icon="git-merge-outline"
              selected={moneyScope === "mixed"}
              onPress={() => setMoneyScope("mixed")}
            />
          </View>
        ) : null}

        {source === "split" ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {selected === "cash_received" ? "How much came in cash?" : "How much was paid in cash?"}
            </Text>
            <TextInput
              keyboardType="numeric"
              value={splitCashAmount}
              onChangeText={setSplitCashAmount}
              placeholder={
                selected === "cash_received"
                  ? "Example: 500"
                  : `Cash available now: Rs ${Math.max(Math.round(currentCashOnHand), 0).toLocaleString("en-IN")}`
              }
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.noteText}>
              {selected === "cash_received"
                ? "The rest will be treated as online / UPI money received."
                : "The rest will be treated as online / UPI automatically."}
            </Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>
            {isCreditCardDue && duePaymentChoice === "minimum"
              ? t(language, "creditCardMinimumLabel")
              : selected === "cash_day_total"
                ? t(language, "dayTotalPrompt")
              : duePrefill.dueName && selected === "due_paid"
                ? duePrefill.dueName
                : selected === "cash_received"
                  ? "Cash Received Amount"
                  : selected === "cash_spent"
                    ? "Big Cash Spent Amount"
                    : selectedOption.title}
          </Text>
          <TextInput
            keyboardType="numeric"
            value={isCreditCardDue && duePaymentChoice === "full" ? formatEditableAmount(fullDueAmount) : amount}
            onChangeText={(text) => {
              if (isCreditCardDue && duePaymentChoice === "minimum") {
                setMinimumAmount(text);
              }
              setAmount(text);
            }}
            placeholder={isCreditCardDue && duePaymentChoice === "minimum" ? t(language, "creditCardMinimumPlaceholder") : "Example: 1500"}
            placeholderTextColor={theme.colors.textMuted}
            editable={!isCreditCardDue || duePaymentChoice === "minimum"}
            style={[styles.input, isCreditCardDue && duePaymentChoice === "full" ? styles.inputDisabled : null]}
          />
          {isCreditCardDue && duePaymentChoice === "full" ? <Text style={styles.noteText}>{t(language, "creditCardFullLocked")}</Text> : null}
        </View>

        {selected === "cash_received" ? (
          <View style={styles.field}>
            <ChoiceCard
              title={t(language, "borrowedToggle")}
              subtitle={t(language, "borrowedHint")}
              icon="swap-horizontal-outline"
              selected={isBorrowedMoney}
              onPress={() => setIsBorrowedMoney((current) => !current)}
            />
            {isBorrowedMoney ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t(language, "borrowedDueDateLabel")}</Text>
                <TextInput
                  value={borrowedDueDate}
                  onChangeText={setBorrowedDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {isCreditCardDue && fullDueAmount ? (
          <View style={styles.field}>
            <Text style={styles.label}>{t(language, "creditCardPaymentQuestion")}</Text>
            <ChoiceCard
              title={`${t(language, "creditCardFullOption")} (${formatMoney(fullDueAmount)})`}
              subtitle={t(language, "creditCardFullHint")}
              icon="checkmark-done-outline"
              selected={duePaymentChoice === "full"}
              onPress={() => setDuePaymentChoice("full")}
            />
            <ChoiceCard
              title={`${t(language, "creditCardMinimumOption")} (${formatMoney(Number(minimumAmount) || suggestedMinimumAmount || 0)})`}
              subtitle={t(language, "creditCardMinimumHint")}
              icon="remove-circle-outline"
              selected={duePaymentChoice === "minimum"}
              onPress={() => setDuePaymentChoice("minimum")}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Short note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={
              isBusinessUser
                ? "Optional: ola driver payment, local shop sale, tyre company, part cash part UPI"
                : "Optional: school fees, mandi sale, wallet cash"
            }
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
        </View>

        <Text style={styles.noteText}>{helperText}</Text>
        {(
          selected === "cash_spent" ||
          selected === "cash_day_total" ||
          selected === "due_paid" ||
          selected === "business_supplier_expense" ||
          selected === "business_cash_expense"
        ) && source !== "online" && source !== "card" ? (
          <Text style={styles.noteText}>{`Cash on hand right now: Rs ${Math.round(currentCashOnHand).toLocaleString("en-IN")}`}</Text>
        ) : null}
        {(
          selected === "cash_spent" ||
          selected === "due_paid" ||
          selected === "business_supplier_expense" ||
          selected === "business_cash_expense"
        ) && (source === "online" || source === "split") ? (
          <Text style={styles.noteText}>{`Bank money right now: Rs ${Math.max(Math.round(currentWorkingBankBalance), 0).toLocaleString("en-IN")}`}</Text>
        ) : null}
      </View>

      <Button
        label={saving ? t(language, "saving") : t(language, "saveRefresh")}
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

          if (selected === "cash_received" && isBorrowedMoney && !borrowedDueDate.trim()) {
            Alert.alert("Add return date", "Tell us when this borrowed money should be returned.");
            return;
          }

          if (isCreditCardDue && duePaymentChoice === "minimum" && fullDueAmount && numericAmount >= fullDueAmount) {
            Alert.alert("Use full amount instead", "This amount clears the whole card bill. Choose Full amount instead.");
            return;
          }

          const numericSplitCashAmount = splitCashAmount.trim() ? Number(splitCashAmount) : 0;
          const isOutflowMode =
            selected === "cash_spent" ||
            selected === "cash_day_total" ||
            selected === "due_paid" ||
            selected === "business_supplier_expense" ||
            selected === "business_cash_expense";
          if (source === "split") {
            if (!Number.isFinite(numericSplitCashAmount) || numericSplitCashAmount <= 0) {
              Alert.alert(
                "Enter cash amount",
                selected === "cash_received"
                  ? "Tell us how much of this money came in cash."
                  : "Tell us how much of this payment went in cash."
              );
              return;
            }
            if (numericSplitCashAmount >= numericAmount) {
              Alert.alert(
                "Use cash only instead",
                selected === "cash_received"
                  ? "If the full amount came in cash, choose Cash instead of split."
                  : "If the full amount was paid in cash, choose Cash instead of split."
              );
              return;
            }
            if (selected !== "cash_received" && numericSplitCashAmount > currentCashOnHand) {
              Alert.alert("Cash is short", "The cash part is more than your cash on hand. Lower the cash part or choose Online / UPI.");
              return;
            }
            const splitOnlineAmount = Math.max(numericAmount - numericSplitCashAmount, 0);
            if (isOutflowMode && splitOnlineAmount > currentWorkingBankBalance) {
              Alert.alert(
                "Bank money is short",
                "The online / UPI part is more than your current bank money. Lower the online part or update bank balance first."
              );
              return;
            }
          }

          if (
            isOutflowMode &&
            source === "cash" &&
            numericAmount > currentCashOnHand
          ) {
            Alert.alert(
              "Cash is short",
              "This amount is more than your current cash on hand. Choose Cash + Online / UPI if the payment was split, or choose Online / UPI."
            );
            return;
          }

          if (isOutflowMode && source === "online" && numericAmount > currentWorkingBankBalance) {
            Alert.alert(
              "Bank money is short",
              "This online / UPI amount is more than your current bank money. Lower the amount or update bank balance first."
            );
            return;
          }

          setSaving(true);
          try {
            const payloads = buildPayloads(selected, numericAmount, note.trim(), source, numericSplitCashAmount, moneyScope, duePrefill);
            for (const payload of payloads) {
              await createLedgerEntry(userId, payload);
            }
            if (selected === "cash_received" && isBorrowedMoney) {
              await createUpcomingDue(userId, {
                name: t(language, "borrowedDueName"),
                amount: numericAmount,
                due_date: borrowedDueDate,
                repeat_monthly: false,
                notes: note.trim() || t(language, "borrowedToggle")
              });
            }
            markHasRealData();
            await refreshDashboard();
            Alert.alert(
              "Updated",
              params.recurringDue === "1" && selected === "due_paid"
                ? t(language, "markedPaidRecurring")
                : selected === "cash_received" && isBorrowedMoney
                  ? t(language, "borrowedConfirmed")
                : isCreditCardDue && duePaymentChoice === "minimum"
                  ? t(language, "creditCardMinimumRecorded")
                : "Your cashflow answer has been refreshed."
            );
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
  inputDisabled: {
    opacity: 0.72
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
