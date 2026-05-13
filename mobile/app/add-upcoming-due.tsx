import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { t } from "../i18n";
import { createUpcomingDue } from "../services/api/moneyos";
import { useSessionStore } from "../store/session";
import { theme } from "../theme";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddUpcomingDueScreen() {
  const userId = useSessionStore((state) => state.userId);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const profile = useSessionStore((state) => state.profile);
  const isBusinessUser = profile?.user_type === "business_self_employed" || profile?.receives_salary_besides_business;
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const markHasRealData = useSessionStore((state) => state.markHasRealData);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [repeatTouched, setRepeatTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (repeatTouched) {
      return;
    }
    const numericAmount = Number(amount);
    setRepeatMonthly(Number.isFinite(numericAmount) && numericAmount > 1000);
  }, [amount, repeatTouched]);

  return (
    <AppScreen
      title={t(language, "addUpcomingDueAction")}
      subtitle={
        language === "hi"
          ? "हमें एक आने वाला ज़रूरी भुगतान बताइए, हम उसे होम जवाब में पहले सुरक्षित रखेंगे।"
          : language === "mr"
            ? "आगामी महत्त्वाचे पेमेंट सांगा, आम्ही ते होम उत्तरात आधी सुरक्षित ठेवू."
            : "Tell us one important payment coming up, and we will protect it in the home answer."
      }
    >
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>{language === "hi" ? "देय का नाम" : language === "mr" ? "देयाचे नाव" : "Due name"}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={
              isBusinessUser
                ? language === "hi"
                  ? "उदाहरण: रमेश सैलरी, टायर कंपनी भुगतान, दुकान किराया"
                  : language === "mr"
                    ? "उदाहरण: रमेश पगार, टायर कंपनी पेमेंट, दुकान भाडे"
                    : "Example: Ramesh salary, tyre company payment, shop rent"
                : language === "hi"
                  ? "उदाहरण: स्कूल फीस, बाइक EMI, किराया"
                  : language === "mr"
                    ? "उदाहरण: शाळेची फी, बाईक EMI, भाडे"
                    : "Example: School fees, Bike EMI, Rent"
            }
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{language === "hi" ? "राशि" : language === "mr" ? "रक्कम" : "Amount"}</Text>
          <TextInput
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder={language === "hi" ? "उदाहरण: 3500" : language === "mr" ? "उदाहरण: 3500" : "Example: 3500"}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{language === "hi" ? "देय तारीख" : language === "mr" ? "देय तारीख" : "Due date"}</Text>
          <TextInput
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
        </View>

        <View style={[styles.helperCard, styles.repeatRow]}>
          <View style={styles.repeatCopy}>
            <Text style={styles.label}>{t(language, "repeatMonthlyToggle")}</Text>
            <Text style={styles.helper}>
              {repeatMonthly
                ? t(language, "repeatMonthlyHint")
                : language === "hi"
                  ? "यह देय सिर्फ इस चक्र के लिए सुरक्षित होगा।"
                  : language === "mr"
                    ? "हे देय फक्त या फेरीसाठी सुरक्षित राहील."
                    : "This protects the due in the current cycle only."}
            </Text>
          </View>
          <Switch
            value={repeatMonthly}
            onValueChange={(value) => {
              setRepeatTouched(true);
              setRepeatMonthly(value);
            }}
            trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{language === "hi" ? "छोटी टिप्पणी" : language === "mr" ? "छोटी नोंद" : "Short note"}</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={
              isBusinessUser
                ? language === "hi"
                  ? "वैकल्पिक: आधा नकद, आधा UPI / 9 स्टाफ में से रमेश"
                  : language === "mr"
                    ? "पर्यायी: अर्धे रोख, अर्धे UPI / 9 स्टाफपैकी रमेश"
                    : "Optional: part cash part UPI / Ramesh out of 9 staff"
                : language === "hi"
                  ? "वैकल्पिक: अप्रैल स्कूल फीस, स्कूटर EMI"
                  : language === "mr"
                    ? "पर्यायी: एप्रिल शाळेची फी, स्कूटर EMI"
                    : "Optional: April school fee, scooter EMI"
            }
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
        </View>
      </View>

      <Button
        label={
          saving
            ? t(language, "saving")
            : language === "hi"
              ? "सेव करें और यह देय सुरक्षित रखें"
              : language === "mr"
                ? "सेव करा आणि हे देय सुरक्षित ठेवा"
                : "Save And Protect This Due"
        }
        disabled={saving || !name.trim() || !amount.trim() || !dueDate.trim()}
        onPress={async () => {
          if (!userId) {
            Alert.alert(
              language === "hi" ? "सेशन नहीं मिला" : language === "mr" ? "सेशन सापडले नाही" : "Missing session",
              language === "hi"
                ? "कृपया एक बार पीछे जाएँ और ऐप फिर से खोलें।"
                : language === "mr"
                  ? "कृपया एकदा मागे जा आणि अॅप पुन्हा उघडा."
                  : "Please go back and reload the app once."
            );
            return;
          }

          const numericAmount = Number(amount);
          if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            Alert.alert(
              language === "hi" ? "राशि भरें" : language === "mr" ? "रक्कम भरा" : "Enter an amount",
              language === "hi"
                ? "कृपया शून्य से बड़ी सही राशि डालें।"
                : language === "mr"
                  ? "कृपया शून्यापेक्षा मोठी योग्य रक्कम भरा."
                  : "Please add a valid amount bigger than zero."
            );
            return;
          }

          if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
            Alert.alert(
              language === "hi" ? "देय तारीख भरें" : language === "mr" ? "देय तारीख भरा" : "Enter a due date",
              language === "hi"
                ? "फिलहाल YYYY-MM-DD फॉर्मेट इस्तेमाल करें।"
                : language === "mr"
                  ? "सध्या YYYY-MM-DD फॉरमॅट वापरा."
                  : "Please use YYYY-MM-DD format for now."
            );
            return;
          }

          setSaving(true);
          try {
            await createUpcomingDue(userId, {
              name: name.trim(),
              amount: numericAmount,
              due_date: dueDate.trim(),
              repeat_monthly: repeatMonthly,
              notes: notes.trim() || null
            });
            markHasRealData();
            await refreshDashboard();
            Alert.alert(
              language === "hi" ? "देय जोड़ दिया गया" : language === "mr" ? "देय जोडले गेले" : "Due added",
              language === "hi"
                ? "यह देय अब आपके होम जवाब में सुरक्षित है।"
                : language === "mr"
                  ? "हे देय आता तुमच्या होम उत्तरात सुरक्षित आहे."
                  : "This due is now protected in your home answer."
            );
            router.back();
          } catch (error) {
            Alert.alert(
              language === "hi" ? "देय सेव नहीं हो पाया" : language === "mr" ? "देय सेव झाले नाही" : "Could not save due",
              error instanceof Error ? error.message : language === "hi" ? "कृपया फिर से कोशिश करें।" : language === "mr" ? "कृपया पुन्हा प्रयत्न करा." : "Please try again."
            );
          } finally {
            setSaving(false);
          }
        }}
      />

      {saving ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>
            {language === "hi"
              ? "यह देय सेव हो रहा है और आपका जवाब रीफ़्रेश हो रहा है।"
              : language === "mr"
                ? "हे देय सेव होत आहे आणि तुमचे उत्तर रीफ्रेश होत आहे."
                : "Saving this due and refreshing your answer."}
          </Text>
        </View>
      ) : null}

      <Button label={t(language, "backHome")} variant="secondary" onPress={() => router.back()} />
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
  helper: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
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
  helperCard: {
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted
  },
  repeatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  repeatCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  loadingText: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  }
});
