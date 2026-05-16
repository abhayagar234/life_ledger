import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

function daysSince(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  const today = new Date();
  parsed.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(Math.round((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)), 0);
}

function daysUntil(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  const today = new Date();
  parsed.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(Math.round((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 1);
}

function buildGaugeState(language: LanguageCode, status?: string | null, confidence?: string | null) {
  if (confidence === "low") {
    return {
      zone: language === "hi" ? "यहीं से शुरू करें" : language === "mr" ? "इथून सुरू करा" : "Start Here",
      color: theme.colors.primary,
      fill: "35%" as const,
      helper: language === "hi" ? "पहले अपने देय जोड़ें" : language === "mr" ? "आधी तुमची देणी जोडा" : "Add your dues first"
    };
  }
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

function isCreditCardDueName(name?: string) {
  if (!name) {
    return false;
  }
  return /(credit|card|\bcc\b)/i.test(name);
}

function buildCreditCardOutstandingWatchout(language: LanguageCode, amount: number) {
  const amountText = formatMoney(amount);
  if (language === "hi") {
    return `${t(language, "creditCardOutstandingWatchout")} - ${amountText} अभी भी असुरक्षित है`;
  }
  if (language === "mr") {
    return `${t(language, "creditCardOutstandingWatchout")} - ${amountText} अजूनही सुरक्षित नाही`;
  }
  return `${t(language, "creditCardOutstandingWatchout")} - ${amountText} still unprotected`;
}

function buildDueSoonWatchouts(
  language: LanguageCode,
  items: Array<{ name: string; due_date: string; status: "pending" | "partial" | "paid"; remaining_amount: number }>
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const watchouts: string[] = [];
  for (const item of items) {
    if (item.status === "paid" || item.remaining_amount <= 0) {
      continue;
    }
    const dueDate = new Date(item.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 || daysLeft > 3) {
      continue;
    }
    if (language === "hi") {
      watchouts.push(`${item.name}: ${daysLeft} दिन में देय · ${formatMoney(item.remaining_amount)}`);
    } else if (language === "mr") {
      watchouts.push(`${item.name}: ${daysLeft} दिवसांत देय · ${formatMoney(item.remaining_amount)}`);
    } else {
      watchouts.push(`${item.name} due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}: ${formatMoney(item.remaining_amount)}.`);
    }
  }
  return watchouts;
}

function buildWatchoutHint(language: LanguageCode) {
  if (language === "hi") {
    return "अगले 3 दिनों में देय रकम, 'ध्यान देने वाली बातें' सेक्शन में दिखेगी।";
  }
  if (language === "mr") {
    return "पुढील 3 दिवसांत येणारी देणी, 'लक्ष द्या' विभागात दिसतील.";
  }
  return "Dues in the next 3 days appear in Watchouts below.";
}

function buildDataHealthLine(
  language: LanguageCode,
  input: {
    liquidBalance?: number | null;
    cashOnHand?: number | null;
    cashIsStale?: boolean;
    staleCashDays?: number | null;
    dueCount?: number;
  }
) {
  const bankPart =
    (input.liquidBalance ?? 0) > 0
      ? language === "hi"
        ? "बैंक ✓"
        : language === "mr"
          ? "बँक ✓"
          : "Bank ✓"
      : language === "hi"
        ? "बैंक —"
        : language === "mr"
          ? "बँक —"
          : "Bank —";

  const cashPart = input.cashIsStale
    ? language === "hi"
      ? `नकद (${input.staleCashDays ?? "?"}d पहले)`
      : language === "mr"
        ? `रोख (${input.staleCashDays ?? "?"}d पूर्वी)`
        : `Cash (${input.staleCashDays ?? "?"}d ago)`
    : (input.cashOnHand ?? 0) > 0
      ? language === "hi"
        ? "नकद ✓"
        : language === "mr"
          ? "रोख ✓"
          : "Cash ✓"
      : language === "hi"
        ? "नकद —"
        : language === "mr"
          ? "रोख —"
          : "Cash —";

  const duePart =
    (input.dueCount ?? 0) > 0
      ? language === "hi"
        ? `${input.dueCount} देय`
        : language === "mr"
          ? `${input.dueCount} देणी`
          : `${input.dueCount} dues`
      : language === "hi"
        ? "कोई देय नहीं"
        : language === "mr"
          ? "देणी नाहीत"
          : "No dues added";

  const prefix = language === "hi" ? "आधार:" : language === "mr" ? "आधार:" : "Based on:";
  return `${prefix} ${bankPart} · ${cashPart} · ${duePart}`;
}

function buildWhyNowLine(language: LanguageCode, dues: string, cash: string, bank: string) {
  if (language === "hi") {
    return `${dues} पहले से बंधा · ${cash} नकद साथ में · ${bank} बैंक / बचत में`;
  }
  if (language === "mr") {
    return `${dues} आधीच बांधलेले · ${cash} हातातील रोख · ${bank} बँक / बचतीत`;
  }
  return `${dues} already spoken for · ${cash} cash with you · ${bank} bank / savings left`;
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

function dailyEditLabel(language: LanguageCode) {
  if (language === "hi") {
    return "बदलें";
  }
  if (language === "mr") {
    return "बदला";
  }
  return "Edit";
}

type SchemeCard = {
  name: string;
  benefit: string;
  fit: string;
};

function buildSchemeCards(language: LanguageCode, userType: string | null | undefined): SchemeCard[] {
  if (language === "hi") {
    switch (userType) {
      case "daily_wage":
        return [
          { name: "E-Shram", benefit: "असंगठित कामगार रजिस्ट्रेशन और सुरक्षा", fit: "दिहाड़ी, मज़दूरी, ड्राइविंग या अनौपचारिक काम करने वालों के लिए सबसे पहले देखने लायक।" },
          { name: "PMSBY", benefit: "₹20/साल में दुर्घटना बीमा", fit: "बहुत कम लागत वाला बुनियादी सुरक्षा कवर।" },
          { name: "PMJJBY", benefit: "₹436/साल में जीवन बीमा", fit: "परिवार पर निर्भर लोग इसे जरूर देखें।" }
        ];
      case "farmer_seasonal":
        return [
          { name: "PM Kisan", benefit: "योग्य किसानों के लिए ₹6,000/साल", fit: "अगर खेती या जमीन से जुड़ा प्रोफाइल है, तो यह सबसे पहले जांचने लायक है।" },
          { name: "PMSBY", benefit: "कम लागत पर दुर्घटना सुरक्षा", fit: "मौसमी और खेत-काम वाले परिवारों के लिए उपयोगी बेसिक कवर।" },
          { name: "E-Shram", benefit: "असंगठित कामगार लाभों का प्रवेश", fit: "अगर खेती के साथ मजदूरी या असंगठित काम भी है, तो यह भी उपयोगी हो सकता है।" }
        ];
      case "business_self_employed":
        return [
          { name: "Udyam Registration", benefit: "छोटे व्यवसाय के लिए औपचारिक पहचान", fit: "अगर आप दुकान, सेवा या छोटा व्यवसाय चलाते हैं तो यह देखने लायक है।" },
          { name: "PMSBY", benefit: "कम लागत वाला दुर्घटना कवर", fit: "स्वयंरोज़गार वालों के लिए बेसिक सुरक्षा से शुरुआत करना आसान होता है।" },
          { name: "PMJJBY", benefit: "सस्ता जीवन सुरक्षा कवर", fit: "अगर परिवार आपकी आय पर निर्भर है, तो यह उपयोगी हो सकता है।" }
        ];
      case "family_manager":
        return [
          { name: "Ayushman Bharat", benefit: "योग्य परिवारों के लिए स्वास्थ्य कवर", fit: "घर संभालने वाले उपयोगकर्ताओं के लिए यह सबसे महत्वपूर्ण जांचों में से एक है।" },
          { name: "PMSBY", benefit: "कम लागत में दुर्घटना सुरक्षा", fit: "पूरे परिवार के लिए बेसिक सुरक्षा शुरू करने का आसान कदम।" },
          { name: "PMJJBY", benefit: "जीवन कवर", fit: "अगर घर की कमाई एक या दो लोगों पर निर्भर है, तो यह देखना चाहिए।" }
        ];
      case "salaried":
      default:
        return [
          { name: "PMSBY", benefit: "कम लागत वाला दुर्घटना कवर", fit: "छोटे प्रीमियम में बुनियादी सुरक्षा देखने लायक।" },
          { name: "PMJJBY", benefit: "सस्ता जीवन कवर", fit: "अगर परिवार आप पर निर्भर है, तो यह अच्छा बेसिक विकल्प हो सकता है।" }
        ];
    }
  }

  if (language === "mr") {
    switch (userType) {
      case "daily_wage":
        return [
          { name: "E-Shram", benefit: "असंघटित कामगार नोंदणी आणि सुरक्षा", fit: "रोजंदारी, मजुरी, ड्रायव्हिंग किंवा अनौपचारिक काम करणाऱ्यांनी आधी हे तपासावे." },
          { name: "PMSBY", benefit: "₹20/वर्ष अपघात विमा", fit: "अतिशय कमी खर्चात मूलभूत सुरक्षा." },
          { name: "PMJJBY", benefit: "₹436/वर्ष जीवन विमा", fit: "कुटुंब तुमच्या उत्पन्नावर अवलंबून असेल तर पाहण्यासारखे." }
        ];
      case "farmer_seasonal":
        return [
          { name: "PM Kisan", benefit: "पात्र शेतकऱ्यांसाठी ₹6,000/वर्ष", fit: "शेती किंवा जमीनाशी जोडलेला प्रोफाइल असेल तर आधी हे तपासावे." },
          { name: "PMSBY", benefit: "कमी खर्चात अपघात सुरक्षा", fit: "हंगामी आणि शेतमजुरी करणाऱ्या कुटुंबांसाठी उपयोगी." },
          { name: "E-Shram", benefit: "असंघटित कामगार लाभांपर्यंत प्रवेश", fit: "शेतीबरोबर इतर मजुरीही असेल तर हेही उपयोगी ठरू शकते." }
        ];
      case "business_self_employed":
        return [
          { name: "Udyam Registration", benefit: "लघु व्यवसायासाठी औपचारिक ओळख", fit: "दुकान, सेवा किंवा छोटा व्यवसाय असेल तर तपासण्यासारखे." },
          { name: "PMSBY", benefit: "कमी खर्चाचा अपघात कवर", fit: "स्वयंरोजगारांसाठी मूलभूत संरक्षणाची चांगली सुरुवात." },
          { name: "PMJJBY", benefit: "स्वस्त जीवन कवर", fit: "कुटुंब उत्पन्नावर अवलंबून असेल तर हे उपयुक्त ठरू शकते." }
        ];
      case "family_manager":
        return [
          { name: "Ayushman Bharat", benefit: "पात्र कुटुंबांसाठी आरोग्य कवर", fit: "घर सांभाळणाऱ्यांसाठी तपासण्यासारख्या महत्त्वाच्या योजनांपैकी एक." },
          { name: "PMSBY", benefit: "कमी खर्चात अपघात सुरक्षा", fit: "संपूर्ण कुटुंबासाठी मूलभूत सुरक्षा सुरू करण्याचा सोपा मार्ग." },
          { name: "PMJJBY", benefit: "जीवन कवर", fit: "घराची कमाई एक-दोन लोकांवर अवलंबून असेल तर पाहावे." }
        ];
      case "salaried":
      default:
        return [
          { name: "PMSBY", benefit: "कमी खर्चाचा अपघात कवर", fit: "लहान प्रीमियममध्ये मूलभूत सुरक्षा पाहण्यासारखी." },
          { name: "PMJJBY", benefit: "स्वस्त जीवन कवर", fit: "कुटुंब तुमच्यावर अवलंबून असेल तर हा चांगला बेसिक पर्याय ठरू शकतो." }
        ];
    }
  }

  switch (userType) {
    case "daily_wage":
      return [
        { name: "E-Shram", benefit: "Registration and protections for informal workers", fit: "Worth checking first if your money comes from labor, driving, delivery, or daily informal work." },
        { name: "PMSBY", benefit: "Accident cover for Rs 20/year", fit: "Very low-cost basic protection." },
        { name: "PMJJBY", benefit: "Life cover for Rs 436/year", fit: "Worth checking if family depends on your earnings." }
      ];
    case "farmer_seasonal":
      return [
        { name: "PM Kisan", benefit: "Rs 6,000/year for eligible farmers", fit: "This is usually the first scheme worth checking for farm-linked households." },
        { name: "PMSBY", benefit: "Low-cost accident protection", fit: "Useful baseline cover for seasonal and field-work households." },
        { name: "E-Shram", benefit: "Access point for informal worker benefits", fit: "Still worth checking if farm income is mixed with labor income." }
      ];
    case "business_self_employed":
      return [
        { name: "Udyam Registration", benefit: "Formal identity for a small business", fit: "Worth checking if you run a shop, service business, or independent work." },
        { name: "PMSBY", benefit: "Low-cost accident cover", fit: "A simple first protection layer for self-employed households." },
        { name: "PMJJBY", benefit: "Affordable life cover", fit: "Useful if your household depends heavily on your business income." }
      ];
    case "family_manager":
      return [
        { name: "Ayushman Bharat", benefit: "Health cover for eligible households", fit: "One of the most important checks for households managing tight monthly money." },
        { name: "PMSBY", benefit: "Low-cost accident protection", fit: "An easy first protection step for the family." },
        { name: "PMJJBY", benefit: "Life cover", fit: "Worth checking if one or two earners carry most of the household load." }
      ];
    case "salaried":
    default:
      return [
        { name: "PMSBY", benefit: "Low-cost accident cover", fit: "Worth checking as a simple protection layer." },
        { name: "PMJJBY", benefit: "Affordable life cover", fit: "A sensible basic check if family depends on your income." }
      ];
  }
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
      bankSeenNegativeHelper: "इस चक्र में जितना आया उससे ज़्यादा बैंक / UPI से निकल चुका है",
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
      bankSeenNegativeHelper: "या फेरीत जितके आले त्यापेक्षा जास्त बँक / UPI मधून गेले आहे",
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
    bankSeenNegativeHelper: "More went out through bank / UPI than came in during this cycle",
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
  const dataMode = useSessionStore((state) => state.dataMode);
  const error = useSessionStore((state) => state.error);
  const homeCopy = buildHomeCopy(language);
  const isBusinessOrHybridUser = profile?.user_type === "business_self_employed" || profile?.receives_salary_besides_business;

  if (!profile) {
    return (
      <AppScreen title={homeCopy.welcomeTitle} subtitle={homeCopy.welcomeSubtitle}>
        <EmptyStateCard title={homeCopy.setupNeeded} body={homeCopy.setupBody} />
        <Button label={homeCopy.startSetup} onPress={() => router.push("/onboarding")} />
      </AppScreen>
    );
  }

  const cashflow = dashboard.cashflowSummary;
  const quickActions = isBusinessOrHybridUser
    ? [
        { key: "business_customer_payment", label: t(language, "businessCustomerPaymentAction"), icon: "cash-outline", hint: t(language, "businessCustomerPaymentHint") },
        { key: "business_supplier_expense", label: t(language, "businessSupplierExpenseAction"), icon: "cube-outline", hint: t(language, "businessSupplierExpenseHint") },
        { key: "business_cash_expense", label: t(language, "businessCashExpenseAction"), icon: "briefcase-outline", hint: t(language, "businessCashExpenseHint") },
        { key: "add_due", label: t(language, "addUpcomingDueAction"), icon: "alarm-outline", hint: homeCopy.protectDueHint }
      ]
    : [
        ...(profile.user_type === "daily_wage" || profile.user_type === "family_manager"
      ? [
          { key: "cash_received", label: t(language, "cashReceivedAction"), icon: "add-circle-outline", hint: homeCopy.addMoneyHint },
          { key: "cash_day_total", label: t(language, "quickActionDayTotal"), icon: "calculator-outline", hint: t(language, "dayTotalHint") },
          { key: "cash_spent", label: t(language, "bigCashSpentAction"), icon: "remove-circle-outline", hint: homeCopy.cashBlindSpotHint }
        ]
      : [
          { key: "cash_received", label: t(language, "cashReceivedAction"), icon: "add-circle-outline", hint: homeCopy.addMoneyHint },
          { key: "cash_spent", label: t(language, "bigCashSpentAction"), icon: "remove-circle-outline", hint: homeCopy.cashBlindSpotHint }
        ]),
        { key: "add_due", label: t(language, "addUpcomingDueAction"), icon: "alarm-outline", hint: homeCopy.protectDueHint }
      ];
  const gauge = buildGaugeState(language, cashflow?.status, cashflow?.confidence);
  const persona = buildPersona(profile.user_type, language);
  const staleLabel = buildStaleLabel(language, cashflow?.latest_activity_date);
  const staleCashDays = daysSince(cashflow?.latest_cash_update_date);
  const nextIncomeDays = daysUntil(cashflow?.next_income_date);
  const keepAsideCopy = buildKeepAsideCopy(language);
  const showStaleCashBanner = Boolean(cashflow?.cash_is_stale);
  const schemeCards = buildSchemeCards(language, profile.user_type);
  const creditCardOutstandingWatchouts =
    cashflow?.protected_due_items
      .filter((item) => item.status === "partial" && item.remaining_amount > 0 && isCreditCardDueName(item.name))
      .map((item) => buildCreditCardOutstandingWatchout(language, item.remaining_amount)) ?? [];
  const dueSoonWatchouts = cashflow ? buildDueSoonWatchouts(language, cashflow.protected_due_items) : [];
  const allWatchouts = Array.from(new Set([...dueSoonWatchouts, ...creditCardOutstandingWatchouts, ...(cashflow?.watchouts ?? [])]));
  const heroValue = cashflow
    ? cashflow.shortfall_amount > 0
      ? formatMoney(cashflow.shortfall_amount)
      : formatMoney(cashflow.safe_to_spend)
    : formatMoney(0);
  const displayedHeroValue = cashflow
    ? showStaleCashBanner
      ? cashflow.shortfall_amount_bank_only > 0
        ? formatMoney(cashflow.shortfall_amount_bank_only)
        : formatMoney(cashflow.safe_to_spend_bank_only)
      : heroValue
    : formatMoney(0);
  const dataHealthLine = cashflow
    ? buildDataHealthLine(language, {
        liquidBalance: cashflow.liquid_balance,
        cashOnHand: cashflow.cash_on_hand,
        cashIsStale: cashflow.cash_is_stale,
        staleCashDays,
        dueCount: cashflow.protected_due_items.length
      })
    : null;
  const displayedBankSeen = cashflow ? Math.max(cashflow.liquid_balance, 0) : 0;
  const heroLabel =
    cashflow?.shortfall_amount && cashflow.shortfall_amount > 0
      ? t(language, "stillToProtect")
      : cashflow?.confidence === "low"
        ? t(language, "safeToSpendIncomplete")
        : cashflow?.confidence === "medium"
          ? t(language, "safeToSpendEstimated")
          : t(language, "safeToSpend");
  const confidenceLabel =
    cashflow?.confidence === "medium"
      ? t(language, "confidenceMedium")
      : cashflow?.confidence === "low"
        ? t(language, "confidenceLow")
        : null;
  const whyNowLine = cashflow
    ? buildWhyNowLine(
        language,
        formatMoney(cashflow.upcoming_dues_total),
        cashflow.cash_is_stale ? "—" : formatMoney(cashflow.cash_on_hand),
        formatMoney(cashflow.working_bank_balance || displayedBankSeen)
      )
    : null;
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

      {error ? (
        <View style={[commonStyles.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>{homeCopy.refreshErrorTitle}</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      ) : null}

      {showStaleCashBanner ? (
        <View style={[commonStyles.card, commonStyles.shadow, styles.staleCashBanner]}>
          <Text style={styles.staleCashBannerTitle}>{t(language, "staleCashBannerTitle")}</Text>
          <Text style={styles.staleCashBannerBody}>{t(language, "staleCashBannerBody")}</Text>
          <Button
            label={t(language, "updateMyCash")}
            onPress={() => router.push({ pathname: "/add-entry", params: { mode: "cash_set" } })}
          />
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

            <Text
              style={[
                styles.heroValue,
                cashflow.confidence === "medium" ? styles.heroValueMediumConfidence : null,
                cashflow.confidence === "low" ? styles.heroValueLowConfidence : null,
                dataMode === "sample" ? styles.heroValueDemo : null
              ]}
            >
              {displayedHeroValue}
            </Text>
            <Text style={styles.heroValueLabel}>{heroLabel}</Text>
            {confidenceLabel ? (
              <View
                style={[
                  styles.confidencePill,
                  cashflow.confidence === "low" ? styles.confidencePillLow : styles.confidencePillMedium
                ]}
              >
                <Text
                  style={[
                    styles.confidencePillText,
                    cashflow.confidence === "low" ? styles.confidencePillTextLow : styles.confidencePillTextMedium
                  ]}
                >
                  {confidenceLabel}
                </Text>
              </View>
            ) : null}
            {cashflow.confidence === "low" ? <Text style={styles.heroConfidenceHelp}>{t(language, "confidenceLowAction")}</Text> : null}
            {showStaleCashBanner ? <Text style={styles.heroConfidenceHelp}>{t(language, "staleCashExcluded")}</Text> : null}
            {cashflow.safe_to_spend <= 0 && (cashflow.cash_on_hand > 0 || (cashflow.working_bank_balance ?? 0) > 0) ? (
              <>
                <Text style={styles.heroConfidenceHelp}>{t(language, "safeZeroCommitted")}</Text>
                <Text style={styles.heroCommittedHelp}>{t(language, "safeZeroCommittedDetail")}</Text>
              </>
            ) : null}
            {dataHealthLine ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/import-statement")}
                style={({ pressed }) => [styles.dataHealthWrap, pressed ? styles.dataHealthWrapPressed : null]}
              >
                <Text style={styles.dataHealthText}>{dataHealthLine}</Text>
              </Pressable>
            ) : null}

            <View style={styles.gaugeTrack}>
              <View style={[styles.gaugeSegment, styles.gaugeDanger]} />
              <View style={[styles.gaugeSegment, styles.gaugeWarning]} />
              <View style={[styles.gaugeSegment, styles.gaugeSafe]} />
              <View style={[styles.gaugeNeedle, { left: gauge.fill, borderBottomColor: gauge.color }]} />
            </View>

            <Text style={styles.gaugeHeadline}>{cashflow.headline}</Text>
            <Text style={styles.gaugeSummary}>{cashflow.plain_summary}</Text>
          </View>

          {whyNowLine ? (
            <View style={[commonStyles.card, styles.whyNowCard]}>
              <Text style={styles.whyNowTitle}>{t(language, "whyNowTitle")}</Text>
              <Text style={styles.whyNowBody}>{whyNowLine}</Text>
            </View>
          ) : null}

          {cashflow.business_reserve_amount > 0 ? (
            <View style={[commonStyles.card, styles.whyNowCard]}>
              <Text style={styles.whyNowTitle}>{t(language, "businessReserveTitle")}</Text>
              <Text style={styles.whyNowBody}>
                {`${formatMoney(cashflow.business_reserve_amount)} ${t(language, "businessReserveBody")}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.metricGrid}>
            <View style={[commonStyles.card, styles.metricCard, styles.metricCardUnified, styles.metricGridItem]}>
              <View style={styles.metricHeaderSimple}>
                <Text style={styles.metricLabel}>
                {cashflow.daily_needs_required > 0 && cashflow.daily_needs_buffer <= 0
                  ? t(language, "dailyNeedsToProtect")
                  : t(language, "dailyNeedsCovered")}
                </Text>
              </View>
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
                {cashflow.baseline_daily_spend > 0 ? ` · ${formatMoney(cashflow.baseline_daily_spend)}/day` : ""}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/edit-daily-needs")}
                style={({ pressed }) => [styles.metricFooterAction, pressed ? styles.metricFooterActionPressed : null]}
              >
                <Text style={styles.metricFooterActionText}>{dailyEditLabel(language)}</Text>
              </Pressable>
            </View>
            <View style={[commonStyles.card, styles.metricCard, styles.metricCardUnified, styles.metricGridItem]}>
              <Text style={styles.metricLabel}>{dataMode === "real" ? t(language, "bankSeen") : t(language, "bankSeenSample")}</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.working_bank_balance || displayedBankSeen)}</Text>
              <Text style={styles.metricHelper}>
                {dataMode !== "real"
                  ? t(language, "bankSeenSampleHelper")
                  : cashflow.liquid_balance < 0
                    ? homeCopy.bankSeenNegativeHelper
                    : homeCopy.bankSeenHelper}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/edit-bank-balance" as never)}
                style={({ pressed }) => [styles.metricFooterAction, pressed ? styles.metricFooterActionPressed : null]}
              >
                <Text style={styles.metricFooterActionText}>{t(language, "bankConfirmEdit")}</Text>
              </Pressable>
            </View>
            {profile.tracks_cash ? (
              <View style={[commonStyles.card, styles.metricCard, styles.metricCardUnified, styles.metricGridItem]}>
                <Text style={styles.metricLabel}>{t(language, "cashWithYou")}</Text>
                <Text style={styles.metricValue}>{cashflow.cash_is_stale ? "—" : formatMoney(cashflow.cash_on_hand)}</Text>
                <Text style={styles.metricHelper}>
                  {cashflow.cash_is_stale
                    ? `${t(language, "staleCashUnknown")}${staleCashDays !== null ? ` · ${staleCashDays}d ago` : ""}`
                    : homeCopy.cashOnHandHelper}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/add-entry", params: { mode: "cash_set" } })}
                  style={({ pressed }) => [styles.metricFooterAction, pressed ? styles.metricFooterActionPressed : null]}
                >
                  <Text style={styles.metricFooterActionText}>{t(language, "bankConfirmEdit")}</Text>
                </Pressable>
              </View>
            ) : null}
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

            {cashflow.protected_due_items.filter((item) => item.source_type !== "statement_pattern").length ? (
              <>
                {cashflow.protected_due_items.filter((item) => item.source_type !== "statement_pattern").map((item) => {
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
                                  recurringDue: item.repeat_monthly ? "1" : undefined,
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
                {cashflow.protected_due_items.filter((item) => item.source_type !== "statement_pattern" && item.status === "paid").length ? (
                  <Text style={styles.paidCountText}>
                    {keepAsideCopy.paidCount(cashflow.protected_due_items.filter((item) => item.source_type !== "statement_pattern" && item.status === "paid").length)}
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
            <Text style={styles.nextStepBody}>{t(language, "keepFreshBody")}</Text>
            <Text style={styles.nextStepHint}>{buildWatchoutHint(language)}</Text>
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

          {schemeCards.length ? (
            <View style={[commonStyles.card, commonStyles.shadow, styles.schemeSection]}>
              <Text style={styles.schemeSectionTitle}>{t(language, "schemesSectionTitle")}</Text>
              <Text style={styles.schemeSectionSubtitle}>{t(language, "schemesSectionSubtitle")}</Text>
              {schemeCards.map((scheme) => (
                <View key={scheme.name} style={[commonStyles.card, styles.schemeCard]}>
                  <View style={styles.schemeHeader}>
                    <View style={styles.schemeIconWrap}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
                    </View>
                    <View style={styles.schemeCopy}>
                      <Text style={styles.schemeName}>{scheme.name}</Text>
                      <Text style={styles.schemeBenefit}>{scheme.benefit}</Text>
                    </View>
                  </View>
                  <Text style={styles.schemeFit}>{scheme.fit}</Text>
                </View>
              ))}
              <Text style={styles.schemeFooter}>{t(language, "schemesSectionFooter")}</Text>
            </View>
          ) : null}
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
              key={action.key}
              label={action.label}
              hint={action.hint}
              icon={action.icon}
              onPress={() => {
                if (action.key === "add_due") {
                  router.push("/add-upcoming-due" as never);
                  return;
                }
                router.push({ pathname: "/add-entry", params: { mode: action.key } });
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t(language, "watchouts")}</Text>
        {allWatchouts.length ? (
          allWatchouts.map((alert) => (
            <View key={alert} style={[commonStyles.card, styles.alertCard]}>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ))
        ) : (
          <EmptyStateCard title="No watchouts yet" body="Once statement data is in, this area will call out dues, shortfalls, and where to stay careful." />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent updates</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/history")}
          style={({ pressed }) => [
            commonStyles.card,
            commonStyles.shadow,
            styles.historyNavCard,
            pressed ? styles.historyNavCardPressed : null
          ]}
        >
          <View style={styles.historyNavRow}>
            <View style={styles.historyNavIconWrap}>
              <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.historyNavCopy}>
              <Text style={styles.historyNavTitle}>This week + recent money updates</Text>
              <Text style={styles.historyNavBody}>Open activity history and what changed recently.</Text>
            </View>
          </View>
        </Pressable>
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
  demoModeBanner: {
    gap: theme.spacing.xs,
    backgroundColor: "#FFF8EA",
    borderColor: "#E7C36A"
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
  staleCashBanner: {
    gap: theme.spacing.sm,
    borderColor: "#E7C36A",
    backgroundColor: "#FFF8EA"
  },
  staleCashBannerTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: "#A86400"
  },
  staleCashBannerBody: {
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
  heroValueMediumConfidence: {
    opacity: 0.78,
    textDecorationLine: "underline",
    textDecorationColor: "#D98B2B",
    textDecorationStyle: "solid"
  },
  heroValueLowConfidence: {
    opacity: 0.45
  },
  heroValueDemo: {
    opacity: 0.4
  },
  heroValueLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  confidencePill: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.pill
  },
  confidencePillMedium: {
    backgroundColor: "#FFF2D6"
  },
  confidencePillLow: {
    backgroundColor: "#FCE6E1"
  },
  confidencePillText: {
    fontSize: theme.typography.caption,
    fontWeight: "700"
  },
  confidencePillTextMedium: {
    color: "#A86400"
  },
  confidencePillTextLow: {
    color: theme.colors.danger
  },
  heroConfidenceHelp: {
    fontSize: theme.typography.caption,
    color: theme.colors.danger,
    lineHeight: 18
  },
  heroCommittedHelp: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    lineHeight: 18
  },
  dataHealthWrap: {
    alignSelf: "flex-start",
    marginTop: theme.spacing.xs
  },
  dataHealthWrapPressed: {
    opacity: 0.7
  },
  dataHealthText: {
    fontSize: theme.typography.caption,
    color: "#6C766F",
    lineHeight: 18
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
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  nextStepCard: {
    gap: theme.spacing.xs
  },
  whyNowCard: {
    gap: theme.spacing.xs,
    backgroundColor: "#F8F4EC"
  },
  whyNowTitle: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  whyNowBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.text
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
  metricCardUnified: {
    minHeight: 134,
    justifyContent: "space-between",
    backgroundColor: "#FCFCFB",
    borderWidth: 1,
    borderColor: "#E6E9E5"
  },
  metricGridItem: {
    width: "48%"
  },
  metricHeaderSimple: {
    marginBottom: 2
  },
  metricFooterAction: {
    alignSelf: "flex-start",
    marginTop: theme.spacing.xs,
    paddingVertical: 2
  },
  metricFooterActionPressed: {
    opacity: 0.65
  },
  metricFooterActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.primary,
    textDecorationLine: "underline"
  },
  metricLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    lineHeight: 18
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text
  },
  metricHelper: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    lineHeight: 18
  },
  historyNavCard: {
    gap: 8,
    backgroundColor: "#F5F9F7",
    borderWidth: 1,
    borderColor: "#D8E8E0"
  },
  historyNavCardPressed: {
    opacity: 0.78
  },
  historyNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  historyNavIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F4EE"
  },
  historyNavCopy: {
    flex: 1,
    gap: 2
  },
  historyNavTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text
  },
  historyNavBody: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  nextStepHint: {
    marginTop: 6,
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
  schemeSection: {
    gap: theme.spacing.sm,
    backgroundColor: "#F5FBF8"
  },
  schemeSectionTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  schemeSectionSubtitle: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  schemeCard: {
    gap: theme.spacing.sm,
    borderColor: "#DCEAE2"
  },
  schemeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  schemeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted
  },
  schemeCopy: {
    flex: 1,
    gap: 2
  },
  schemeName: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  schemeBenefit: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary
  },
  schemeFit: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  schemeFooter: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
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
