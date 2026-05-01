import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { EmptyStateCard } from "../../components/EmptyStateCard";
import { QuickActionTile } from "../../components/QuickActionTile";
import { LanguageCode, t } from "../../i18n";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

function formatMoney(amount: number | null | undefined) {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;
  return `Rs ${Math.round(safeAmount).toLocaleString("en-IN")}`;
}

function buildStaleLabel(language: LanguageCode, latestActivityDate?: string | null) {
  if (!latestActivityDate) {
    return language === "hi"
      ? "अभी हाल का कोई पैसा अपडेट नहीं है।"
      : language === "mr"
        ? "अजून अलीकडचा पैशांचा अपडेट नाही."
        : "No recent money update yet.";
  }
  const latest = new Date(latestActivityDate);
  const today = new Date();
  latest.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - latest.getTime();
  const diffDays = Math.max(Math.round(diffMs / (1000 * 60 * 60 * 24)), 0);

  if (diffDays === 0) {
    return language === "hi" ? "आज अपडेट किया गया।" : language === "mr" ? "आज अपडेट केले." : "Updated today.";
  }
  if (diffDays === 1) {
    return language === "hi"
      ? "आखिरी अपडेट 1 दिन पहले था - आज का खर्च जोड़ें।"
      : language === "mr"
        ? "शेवटचा अपडेट 1 दिवसापूर्वी झाला - आजचा खर्च जोडा."
        : "Last updated 1 day ago - add today's spend.";
  }
  return language === "hi"
    ? `आखिरी अपडेट ${diffDays} दिन पहले था - आज का खर्च जोड़ें।`
    : language === "mr"
      ? `शेवटचा अपडेट ${diffDays} दिवसांपूर्वी झाला - आजचा खर्च जोडा.`
      : `Last updated ${diffDays} days ago - add today's spend.`;
}

function buildSafeToSpendHelper(
  language: LanguageCode,
  profile: { income_pattern?: string | null; next_income_in_days?: number | null; salary_day_of_month?: number | null } | null,
  nextIncomeDate?: string | null
) {
  if (profile?.next_income_in_days) {
    if (profile.next_income_in_days <= 3) {
      return language === "hi" ? "अगले कुछ दिनों के लिए" : language === "mr" ? "पुढच्या काही दिवसांसाठी" : "for the next few days";
    }
    if (profile.next_income_in_days <= 7) {
      return language === "hi" ? "अगले हफ्ते के लिए" : language === "mr" ? "पुढच्या आठवड्यासाठी" : "for the next week";
    }
    if (profile.next_income_in_days <= 30) {
      return language === "hi" ? "अगले पैसे आने तक" : language === "mr" ? "पुढचे पैसे येईपर्यंत" : "till the next money point";
    }
    return language === "hi" ? "अगले बड़े पैसे आने तक" : language === "mr" ? "पुढचे मोठे पैसे येईपर्यंत" : "till the next big money point";
  }
  if (profile?.income_pattern === "weekly") {
    return language === "hi" ? "इस हफ्ते के बाकी दिनों के लिए" : language === "mr" ? "या आठवड्याच्या उरलेल्या दिवसांसाठी" : "for the rest of this week";
  }
  if (profile?.income_pattern === "daily") {
    return language === "hi" ? "अगले कुछ दिनों के लिए" : language === "mr" ? "पुढच्या काही दिवसांसाठी" : "for the next few days";
  }
  if (profile?.income_pattern === "seasonal" || profile?.income_pattern === "mixed") {
    return language === "hi" ? "अगले पैसे आने तक" : language === "mr" ? "पुढचे पैसे येईपर्यंत" : "till the next money point";
  }
  if (nextIncomeDate) {
    const dateText = new Date(nextIncomeDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return language === "hi" ? `${dateText} से पहले` : language === "mr" ? `${dateText} आधी` : `before ${dateText}`;
  }
  return language === "hi" ? "अगले पैसे आने से पहले" : language === "mr" ? "पुढचे पैसे येण्याआधी" : "before next money in";
}

function buildGaugeState(language: LanguageCode, status?: string | null) {
  if (status === "risk") {
    return {
      zone: language === "hi" ? "लाल ज़ोन" : language === "mr" ? "लाल भाग" : "Red Zone",
      color: theme.colors.danger,
      fill: "18%" as const,
      helper: language === "hi" ? "खतरा, धीरे चलें" : language === "mr" ? "धोका, खर्च सावकाश करा" : "Danger, slow down"
    };
  }
  if (status === "tight") {
    return {
      zone: language === "hi" ? "पीला ज़ोन" : language === "mr" ? "पिवळा भाग" : "Yellow Zone",
      color: theme.colors.warning,
      fill: "48%" as const,
      helper: language === "hi" ? "पैसा टाइट हो रहा है" : language === "mr" ? "पैसे कमी पडू लागले आहेत" : "Getting tight"
    };
  }
  if (status === "safe") {
    return {
      zone: language === "hi" ? "हरा ज़ोन" : language === "mr" ? "हिरवा भाग" : "Green Zone",
      color: theme.colors.success,
      fill: "82%" as const,
      helper: language === "hi" ? "फिलहाल सुरक्षित" : language === "mr" ? "सध्या सुरक्षित" : "Safe"
    };
  }
  return {
    zone: language === "hi" ? "यहीं से शुरू करें" : language === "mr" ? "इथून सुरू करा" : "Start Here",
    color: theme.colors.primary,
    fill: "35%" as const,
    helper: language === "hi" ? "पहले स्टेटमेंट लोड करें" : language === "mr" ? "आधी स्टेटमेंट लोड करा" : "Load a statement first"
  };
}

function buildPersona(userType: string | null | undefined, language: LanguageCode) {
  switch (userType) {
    case "salaried":
      return {
        emoji: "💼",
        title: language === "hi" ? "वेतनभोगी" : language === "mr" ? "पगारदार" : "Salaried",
        subtitle:
          language === "hi"
            ? "मासिक वेतन और नियमित बिल"
            : language === "mr"
              ? "मासिक पगार आणि नियमित बिले"
              : "Monthly salary and regular bills"
      };
    case "daily_wage":
      return {
        emoji: "🛠️",
        title: language === "hi" ? "दिहाड़ी मज़दूर" : language === "mr" ? "रोजंदारी कामगार" : "Daily Wage",
        subtitle:
          language === "hi"
            ? "रोज़ का काम, कैश फ्लो और अनिश्चित आय"
            : language === "mr"
              ? "रोजचे काम, रोख प्रवाह आणि अनियमित उत्पन्न"
              : "Daily work, cash flow, and uneven income"
      };
    case "farmer_seasonal":
      return {
        emoji: "🌾",
        title: language === "hi" ? "किसान / मौसमी" : language === "mr" ? "शेतकरी / मोसमी" : "Farmer / Seasonal",
        subtitle:
          language === "hi"
            ? "सीजन में लहरों की तरह आय आती है"
            : language === "mr"
              ? "हंगामात टप्प्याटप्प्याने उत्पन्न येते"
              : "Income comes in waves across the season"
      };
    case "business_self_employed":
      return {
        emoji: "🏪",
        title: language === "hi" ? "व्यवसाय / स्वयंरोज़गार" : language === "mr" ? "व्यवसाय / स्वयंरोजगार" : "Business / Self-Employed",
        subtitle:
          language === "hi"
            ? "बिक्री, खर्च और मिला-जुला पैसा"
            : language === "mr"
              ? "विक्री, खर्च आणि मिसळलेले पैसे"
              : "Sales, expenses, and mixed money"
      };
    case "family_manager":
      return {
        emoji: "🏠",
        title: language === "hi" ? "परिवार संभालने वाले" : language === "mr" ? "घराचा कारभारी" : "Family Manager",
        subtitle:
          language === "hi"
            ? "घर के पैसों को साफ दिखाना"
            : language === "mr"
              ? "घरचे पैसे स्पष्ट दिसणे"
              : "Keeping household money visible"
      };
    default:
      return null;
  }
}

function formatDueDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function buildDueStatusCopy(language: LanguageCode, item: {
  status: "pending" | "partial" | "paid";
  amount_paid: number;
  remaining_amount: number;
}) {
  if (item.status === "paid") {
    return {
      helper: null,
      actionLabel: null
    };
  }
  if (item.status === "partial") {
    return {
      helper:
        language === "hi"
          ? `${formatMoney(item.amount_paid)} भर गए, ${formatMoney(item.remaining_amount)} अभी बाकी हैं`
          : language === "mr"
            ? `${formatMoney(item.amount_paid)} भरले, ${formatMoney(item.remaining_amount)} अजून बाकी आहेत`
            : `${formatMoney(item.amount_paid)} paid, ${formatMoney(item.remaining_amount)} still left`,
      actionLabel: language === "hi" ? "बाकी भरें" : language === "mr" ? "उरलेले भरा" : "Pay remaining"
    };
  }
  return {
    helper:
      language === "hi"
        ? `${formatMoney(item.remaining_amount)} अभी अलग रखना है`
        : language === "mr"
          ? `${formatMoney(item.remaining_amount)} अजून बाजूला ठेवायचे आहेत`
          : `${formatMoney(item.remaining_amount)} still to protect`,
    actionLabel: language === "hi" ? "भर दिया" : language === "mr" ? "भरले" : "Mark paid"
  };
}

function buildKeepAsideCopy(language: LanguageCode) {
  if (language === "hi") {
    return {
      eyebrow: "पहले अलग रखें",
      title: "अगले पैसे आने से पहले",
      emptyTitle: "अभी कोई नाम वाली देनदारी नहीं",
      emptyBody: "सैंपल स्टेटमेंट लोड करें या आने वाली देनदारी जोड़ें, फिर ऐप यहां बताएगा कि क्या पहले अलग रखना है।",
      safeAfter: "इसके बाद सुरक्षित खर्च",
      paidCount: (count: number) => `${count} इस चक्र में निपटा दिए गए`
    };
  }
  if (language === "mr") {
    return {
      eyebrow: "आधी बाजूला ठेवा",
      title: "पुढचे पैसे येण्यापूर्वी",
      emptyTitle: "आत्ता नावाने देणी दिसत नाहीत",
      emptyBody: "नमुना स्टेटमेंट लोड करा किंवा येणारे देणे जोडा, मग अॅप इथे आधी काय बाजूला ठेवायचे ते दाखवेल.",
      safeAfter: "यानंतर सुरक्षित खर्च",
      paidCount: (count: number) => `${count} या फेरीत भरले गेले`
    };
  }
  return {
    eyebrow: "Keep Aside First",
    title: "Before the next money comes in",
    emptyTitle: "No named dues yet",
    emptyBody: "Load a sample statement or add an upcoming due, and the app will show exactly what should be kept aside here first.",
    safeAfter: "Safe after this",
    paidCount: (count: number) => `${count} already handled this cycle`
  };
}

function buildHomeCopy(language: LanguageCode) {
  if (language === "hi") {
    return {
      welcomeTitle: "स्वागत है",
      welcomeSubtitle: "अपने लिए सही होम स्क्रीन देखने के लिए सेटअप शुरू करें।",
      setupNeeded: "सेटअप ज़रूरी है",
      setupBody: "डैशबोर्ड खोलने के लिए अपना यूज़र टाइप और पैसे का तरीका चुनें।",
      startSetup: "सेटअप शुरू करें",
      moneyPath: "आपका पैसों का रास्ता",
      refreshErrorTitle: "सब कुछ रीफ़्रेश नहीं हो पाया",
      moneyFuel: "पैसों की स्थिति",
      fromStatementHistory: "स्टेटमेंट हिस्ट्री से",
      addedByYou: "आपने जोड़ा",
      trustBody: "जब भी असली स्थिति बदले, नकद, ऑनलाइन खर्च या भरे गए देय अपडेट करें ताकि यह जवाब भरोसेमंद रहे।",
      keptAsideFirst: "पहले अलग रखा गया",
      needsEstimateLater: "और खर्च हिस्ट्री आने पर रोज़मर्रा ज़रूरत का अनुमान बेहतर होगा।",
      neededBeforeNextMoney: "अगले पैसे आने से पहले ज़रूरी",
      fullyCoveredTillNextIncome: "अगले पैसे आने तक पूरी तरह कवर",
      ofNeededTillNextIncome: (amount: string) => `अगले पैसे आने तक ज़रूरी ${amount} में से`,
      bankSeenHelper: "स्टेटमेंट गतिविधि से अनुमानित",
      cashOnHandHelper: "आपके आखिरी नकद अपडेट पर आधारित",
      addMoneyHint: "आज आया पैसा जोड़ें",
      resetCashHint: "अगर दिख रहा नकद गलत है तो सही करें",
      cashBlindSpotHint: "नकद वाले अंधे हिस्से को भरें",
      protectDueHint: "जो देय अभी नहीं दिख रहा, उसे सुरक्षित करें"
    };
  }
  if (language === "mr") {
    return {
      welcomeTitle: "स्वागत",
      welcomeSubtitle: "तुमच्यासाठी योग्य होम स्क्रीन पाहण्यासाठी सेटअप सुरू करा.",
      setupNeeded: "सेटअप आवश्यक आहे",
      setupBody: "डॅशबोर्ड उघडण्यासाठी तुमचा वापरकर्ता प्रकार आणि पैशांची पद्धत निवडा.",
      startSetup: "सेटअप सुरू करा",
      moneyPath: "तुमचा पैशांचा मार्ग",
      refreshErrorTitle: "सगळे रीफ्रेश झाले नाही",
      moneyFuel: "पैशांची स्थिती",
      fromStatementHistory: "स्टेटमेंट हिस्ट्रीमधून",
      addedByYou: "तुम्ही जोडले",
      trustBody: "खरी परिस्थिती बदलली की रोख, ऑनलाइन खर्च किंवा भरलेले देणे अपडेट करा, म्हणजे हे उत्तर विश्वासार्ह राहील.",
      keptAsideFirst: "आधी बाजूला ठेवले",
      needsEstimateLater: "अजून खर्च हिस्टरी आल्यावर रोजच्या गरजांचा अंदाज चांगला होईल.",
      neededBeforeNextMoney: "पुढचे पैसे येण्याआधी गरजेचे",
      fullyCoveredTillNextIncome: "पुढचे पैसे येईपर्यंत पूर्ण कव्हर",
      ofNeededTillNextIncome: (amount: string) => `पुढचे पैसे येईपर्यंत लागणाऱ्या ${amount} पैकी`,
      bankSeenHelper: "स्टेटमेंट हालचालीवरून अंदाज",
      cashOnHandHelper: "तुमच्या शेवटच्या रोख अपडेटवर आधारित",
      addMoneyHint: "आज आलेले पैसे जोडा",
      resetCashHint: "दिसणारी रोख चुकत असेल तर दुरुस्त करा",
      cashBlindSpotHint: "रोख खर्चातील उणीव भरा",
      protectDueHint: "जो देय अजून दिसत नाही तो सुरक्षित करा"
    };
  }
  return {
    welcomeTitle: "Welcome",
    welcomeSubtitle: "Start setup to see the right home screen for you.",
    setupNeeded: "Setup needed",
    setupBody: "Choose your user type and money rhythm to unlock the dashboard.",
    startSetup: "Start Setup",
    moneyPath: "Your Money Path",
    refreshErrorTitle: "Could not refresh everything",
    moneyFuel: "Money Fuel",
    fromStatementHistory: "from statement history",
    addedByYou: "added by you",
    trustBody: "Update cash, online spend, or a paid due whenever reality changes so this answer stays trustworthy.",
    keptAsideFirst: "kept aside first",
    needsEstimateLater: "Needs estimate starts after more spend history.",
    neededBeforeNextMoney: "needed before the next money point",
    fullyCoveredTillNextIncome: "fully covered till next income",
    ofNeededTillNextIncome: (amount: string) => `of ${amount} needed till next income`,
    bankSeenHelper: "estimated from statement activity",
    cashOnHandHelper: "based on your latest cash update",
    addMoneyHint: "add money that came in today",
    resetCashHint: "reset if the shown cash looks wrong",
    cashBlindSpotHint: "fill the cash blind spot",
    protectDueHint: "protect a due that is not visible yet"
  };
}

export default function HomeScreen() {
  const profile = useSessionStore((state) => state.profile);
  const displayName = useSessionStore((state) => state.displayName);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const dashboard = useSessionStore((state) => state.dashboard);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const error = useSessionStore((state) => state.error);
  const homeCopy = buildHomeCopy(language);

  if (!profile) {
    return (
      <AppScreen title={homeCopy.welcomeTitle} subtitle={homeCopy.welcomeSubtitle}>
        <EmptyStateCard title={homeCopy.setupNeeded} body={homeCopy.setupBody} />
        <Button label={homeCopy.startSetup} onPress={() => router.push("/onboarding")} />
      </AppScreen>
    );
  }

  const cashflow = dashboard.cashflowSummary;
  const quickActions = [
    { label: t(language, "cashReceivedAction"), icon: "add-circle-outline", hint: homeCopy.addMoneyHint },
    { label: t(language, "cashInHandAction"), icon: "wallet-outline", hint: homeCopy.resetCashHint },
    { label: t(language, "bigCashSpentAction"), icon: "remove-circle-outline", hint: homeCopy.cashBlindSpotHint },
    { label: t(language, "addUpcomingDueAction"), icon: "alarm-outline", hint: homeCopy.protectDueHint }
  ];
  const gauge = buildGaugeState(language, cashflow?.status);
  const persona = buildPersona(profile.user_type, language);
  const staleLabel = buildStaleLabel(language, cashflow?.latest_activity_date);
  const keepAsideCopy = buildKeepAsideCopy(language);
  const primaryBannerAction = cashflow
    ? {
        label: t(language, "updateTodayMoney"),
        onPress: () => router.push("/import-statement")
      }
    : {
        label: t(language, "loadSample"),
        onPress: () => router.push("/import-statement")
      };

  return (
    <AppScreen
      title={`Hello, ${displayName}`}
      subtitle={t(language, "homeSubtitle")}
      headerRight={
        <Button
          label={t(language, "refresh")}
          variant="secondary"
          onPress={() => {
            void refreshDashboard();
          }}
        />
      }
    >
      {persona ? (
        <View style={[commonStyles.card, styles.personaBanner]}>
          <View style={styles.personaAvatar}>
            <Text style={styles.personaEmoji}>{persona.emoji}</Text>
          </View>
          <View style={styles.personaCopy}>
            <Text style={styles.personaEyebrow}>{homeCopy.moneyPath}</Text>
            <Text style={styles.personaTitle}>{persona.title}</Text>
            <Text style={styles.personaBody}>{persona.subtitle}</Text>
          </View>
        </View>
      ) : null}

      <View style={[commonStyles.card, styles.demoBanner]}>
        <Text style={styles.demoEyebrow}>{t(language, "startHere")}</Text>
        <Text style={styles.demoTitle}>{cashflow ? t(language, "keepFresh") : t(language, "bringHistory")}</Text>
        <Text style={styles.demoBody}>
          {cashflow
            ? t(language, "keepFreshBody")
            : t(language, "cleanStartBody")}
        </Text>
        <View style={styles.bannerActions}>
          <Button label={primaryBannerAction.label} onPress={primaryBannerAction.onPress} />
        </View>
      </View>

      {error ? (
        <View style={[commonStyles.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>{homeCopy.refreshErrorTitle}</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      ) : null}

      {cashflow ? (
        <>
          <View style={[commonStyles.card, commonStyles.shadow, styles.gaugeCard]}>
            <View style={styles.gaugeHeader}>
              <Text style={styles.gaugeEyebrow}>{homeCopy.moneyFuel}</Text>
              <View style={[styles.zonePill, { backgroundColor: gauge.color }]}>
                <Text style={styles.zonePillText}>{gauge.zone}</Text>
              </View>
            </View>

            <Text style={styles.heroValue}>
              {cashflow.shortfall_amount > 0 ? formatMoney(cashflow.shortfall_amount) : formatMoney(cashflow.safe_to_spend)}
            </Text>
            <Text style={styles.heroValueLabel}>
              {cashflow.shortfall_amount > 0 ? t(language, "stillToProtect") : t(language, "safeToSpend")}
            </Text>

            <View style={styles.gaugeTrack}>
              <View style={[styles.gaugeSegment, styles.gaugeDanger]} />
              <View style={[styles.gaugeSegment, styles.gaugeWarning]} />
              <View style={[styles.gaugeSegment, styles.gaugeSafe]} />
              <View style={[styles.gaugeNeedle, { left: gauge.fill, borderBottomColor: gauge.color }]} />
            </View>

            <Text style={styles.gaugeHeadline}>{cashflow.headline}</Text>
            <Text style={styles.gaugeSummary}>{cashflow.plain_summary}</Text>
          </View>

          <View style={[commonStyles.card, commonStyles.shadow, styles.requiredCard]}>
            <View style={styles.requiredHeader}>
              <View style={styles.requiredCopy}>
                <Text style={styles.requiredEyebrow}>{keepAsideCopy.eyebrow}</Text>
                <Text style={styles.requiredTitle}>{keepAsideCopy.title}</Text>
              </View>
              <View style={styles.requiredTotalWrap}>
                <Text style={styles.requiredTotal}>{formatMoney(cashflow.upcoming_dues_total)}</Text>
                <Text style={styles.requiredTotalLabel}>{keepAsideCopy.safeAfter}: {formatMoney(cashflow.safe_to_spend)}</Text>
              </View>
            </View>

            {cashflow.protected_due_items.length ? (
              <>
                {cashflow.protected_due_items.map((item) => {
                  const isPaid = item.status === "paid";
                  const isPartial = item.status === "partial";
                  const dueStatus = buildDueStatusCopy(language, item);
                  return (
                    <View
                      key={item.due_key}
                      style={[
                        commonStyles.card,
                        styles.dueCard,
                        isPaid ? styles.dueCardPaid : null,
                        isPartial ? styles.dueCardPartial : null
                      ]}
                    >
                      <View style={styles.dueCardTop}>
                        <View style={styles.dueCopy}>
                          <Text style={[styles.dueName, isPaid ? styles.dueNamePaid : null]}>{item.name}</Text>
                          <Text style={styles.dueMeta}>
                            {formatDueDate(item.due_date)} · {item.source_type === "statement_pattern" ? homeCopy.fromStatementHistory : homeCopy.addedByYou}
                          </Text>
                        </View>
                        <Text style={[styles.dueAmount, isPaid ? styles.dueAmountPaid : null]}>
                          {formatMoney(isPaid ? item.amount : item.remaining_amount || item.amount)}
                        </Text>
                      </View>
                      {isPaid ? (
                        <Text style={styles.duePaidText}>{t(language, "paidThisCycle")}</Text>
                      ) : (
                        <View style={styles.dueActions}>
                          {dueStatus.helper ? <Text style={styles.duePendingText}>{dueStatus.helper}</Text> : null}
                          <Button
                            label={dueStatus.actionLabel ?? t(language, "markPaid")}
                            variant="secondary"
                            onPress={() =>
                              router.push({
                                pathname: "/add-entry",
                                params: {
                                  mode: "due_paid",
                                  amount: String(Math.round(item.remaining_amount || item.amount)),
                                  dueName: item.name,
                                  dueKey: item.due_key,
                                  emiPaymentId: item.emi_payment_id ?? undefined,
                                  note: item.name
                                }
                              })
                            }
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
                {cashflow.protected_due_items.some((item) => item.status === "paid") ? (
                  <Text style={styles.paidCountText}>
                    {keepAsideCopy.paidCount(cashflow.protected_due_items.filter((item) => item.status === "paid").length)}
                  </Text>
                ) : null}
              </>
            ) : (
              <EmptyStateCard title={keepAsideCopy.emptyTitle} body={keepAsideCopy.emptyBody} />
            )}
          </View>

          <View style={[commonStyles.card, styles.nextStepCard]}>
            <Text style={styles.nextStepEyebrow}>{t(language, "keepFresh")}</Text>
            <Text style={styles.nextStepTitle}>{staleLabel}</Text>
            <Text style={styles.nextStepBody}>{homeCopy.trustBody}</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>{t(language, "safeToSpend")}</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.safe_to_spend)}</Text>
              <Text style={styles.metricHelper}>
                {buildSafeToSpendHelper(language, profile, cashflow.next_income_date)}
              </Text>
            </View>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>{t(language, "upcomingDues")}</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.upcoming_dues_total)}</Text>
              <Text style={styles.metricHelper}>{homeCopy.keptAsideFirst}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>
                {cashflow.daily_needs_required > 0 && cashflow.daily_needs_buffer <= 0
                  ? t(language, "dailyNeedsToProtect")
                  : t(language, "dailyNeedsCovered")}
              </Text>
              <Text style={styles.metricValue}>
                {formatMoney(cashflow.daily_needs_required > 0 && cashflow.daily_needs_buffer <= 0 ? cashflow.daily_needs_required : cashflow.daily_needs_buffer)}
              </Text>
              <Text style={styles.metricHelper}>
                {cashflow.daily_needs_required <= 0
                  ? homeCopy.needsEstimateLater
                  : cashflow.daily_needs_buffer <= 0
                    ? homeCopy.neededBeforeNextMoney
                    : cashflow.daily_needs_buffer >= cashflow.daily_needs_required
                      ? homeCopy.fullyCoveredTillNextIncome
                      : homeCopy.ofNeededTillNextIncome(formatMoney(cashflow.daily_needs_required))}
              </Text>
            </View>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>{t(language, "bankSeen")}</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.liquid_balance)}</Text>
              <Text style={styles.metricHelper}>{homeCopy.bankSeenHelper}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>{t(language, "cashOnHand")}</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.cash_on_hand)}</Text>
              <Text style={styles.metricHelper}>{homeCopy.cashOnHandHelper}</Text>
            </View>
          </View>

          <View style={[commonStyles.card, commonStyles.shadow, styles.highlightCard]}>
            <View style={styles.highlightHeader}>
              <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>{t(language, "whyWeThinkSo")}</Text>
            </View>
            {cashflow.explanations.map((line) => (
              <Text key={line} style={styles.highlightText}>
                {line}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <EmptyStateCard
          title={t(language, "noHistoryTitle")}
          body={t(language, "noHistoryBody")}
        />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t(language, "moreActions")}</Text>
        <View style={styles.grid}>
          {quickActions.map((action) => (
            <QuickActionTile
              key={action.label}
              label={action.label}
              hint={action.hint}
              icon={action.icon}
              onPress={() => {
                if (action.label === t(language, "addUpcomingDueAction")) {
                  router.push("/add-upcoming-due" as never);
                  return;
                }
                if (action.label === t(language, "cashReceivedAction")) {
                  router.push({ pathname: "/add-entry", params: { mode: "cash_received" } });
                  return;
                }
                if (action.label === t(language, "cashInHandAction")) {
                  router.push({ pathname: "/add-entry", params: { mode: "cash_set" } });
                  return;
                }
                router.push({ pathname: "/add-entry", params: { mode: "cash_spent" } });
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t(language, "watchouts")}</Text>
        {cashflow?.watchouts.length ? (
          cashflow.watchouts.map((alert) => (
            <View key={alert} style={[commonStyles.card, styles.alertCard]}>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ))
        ) : (
          <EmptyStateCard title="No watchouts yet" body="Once statement data is in, this area will call out dues, shortfalls, and where to stay careful." />
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  personaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: "#FFF8EA"
  },
  personaAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFE8B0"
  },
  personaEmoji: {
    fontSize: 30
  },
  personaCopy: {
    flex: 1,
    gap: 2
  },
  personaEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  personaTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  personaBody: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  demoBanner: {
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceMuted
  },
  demoEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  demoTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  demoBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  bannerActions: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm
  },
  errorCard: {
    gap: theme.spacing.xs,
    borderColor: "#E7B8AD",
    backgroundColor: "#FFF5F2"
  },
  errorTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.danger
  },
  errorBody: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  heroValue: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: theme.colors.text
  },
  heroValueLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  gaugeCard: {
    gap: theme.spacing.md
  },
  gaugeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.md
  },
  gaugeEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  zonePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill
  },
  zonePillText: {
    fontSize: theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "700"
  },
  gaugeTrack: {
    position: "relative",
    flexDirection: "row",
    height: 18,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceMuted
  },
  gaugeSegment: {
    flex: 1
  },
  gaugeDanger: {
    backgroundColor: "#D88B79"
  },
  gaugeWarning: {
    backgroundColor: "#E7C36A"
  },
  gaugeSafe: {
    backgroundColor: "#74B983"
  },
  gaugeNeedle: {
    position: "absolute",
    top: -10,
    marginLeft: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent"
  },
  gaugeHeadline: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: theme.colors.text
  },
  gaugeSummary: {
    fontSize: theme.typography.body,
    lineHeight: 24,
    color: theme.colors.textMuted
  },
  metricRow: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  nextStepCard: {
    gap: theme.spacing.xs
  },
  nextStepEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  nextStepTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  nextStepBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  requiredCard: {
    gap: theme.spacing.md,
    backgroundColor: "#FFF9EF"
  },
  requiredHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md
  },
  requiredCopy: {
    flex: 1,
    gap: 4
  },
  requiredEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  requiredTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  requiredTotalWrap: {
    alignItems: "flex-end",
    gap: 4
  },
  requiredTotal: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text
  },
  requiredTotalLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: "right"
  },
  metricCard: {
    flex: 1,
    gap: theme.spacing.xs
  },
  metricLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text
  },
  metricHelper: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  section: {
    gap: theme.spacing.md
  },
  sectionTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  highlightCard: {
    gap: theme.spacing.sm
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  highlightText: {
    fontSize: theme.typography.body,
    lineHeight: 24,
    color: theme.colors.textMuted
  },
  alertCard: {
    paddingVertical: theme.spacing.md
  },
  alertText: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.text
  },
  dueCard: {
    gap: theme.spacing.sm
  },
  dueCardPaid: {
    backgroundColor: "#F7F5EE"
  },
  dueCardPartial: {
    borderColor: "#F4C95D",
    borderWidth: 1.5
  },
  dueCardTop: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "flex-start"
  },
  dueCopy: {
    flex: 1,
    gap: 4
  },
  dueName: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  dueNamePaid: {
    color: theme.colors.textMuted,
    textDecorationLine: "line-through"
  },
  dueMeta: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  dueAmount: {
    fontSize: theme.typography.body,
    fontWeight: "800",
    color: theme.colors.text
  },
  dueAmountPaid: {
    color: theme.colors.textMuted,
    textDecorationLine: "line-through"
  },
  dueActions: {
    alignItems: "flex-start",
    gap: theme.spacing.xs
  },
  duePendingText: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  duePaidText: {
    fontSize: theme.typography.caption,
    color: theme.colors.success,
    fontWeight: "700"
  },
  paidCountText: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  }
});
