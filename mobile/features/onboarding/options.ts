import type { IncomePattern, MoneyMixType, TrackingScope, UserType } from "../../services/api/types";
import type { LanguageCode } from "../../i18n";

const userTypeOptionsByLanguage: Record<LanguageCode, Array<{
  value: UserType;
  title: string;
  subtitle: string;
  icon: string;
}>> = {
  en: [
    { value: "salaried", title: "💼 Salaried", subtitle: "Corporate professional, office staff, monthly salary", icon: "wallet-outline" },
    { value: "daily_wage", title: "🛠️ Daily Wage", subtitle: "Construction worker, driver, helper, daily income", icon: "sunny-outline" },
    { value: "farmer_seasonal", title: "🌾 Farmer / Seasonal", subtitle: "Harvest income or money that comes in waves", icon: "leaf-outline" },
    { value: "business_self_employed", title: "🏪 Business / Self-Employed", subtitle: "Shop owner, freelancer, service work, mixed money", icon: "storefront-outline" },
    { value: "family_manager", title: "🏠 Family Manager", subtitle: "One person keeping household money visible", icon: "people-outline" }
  ],
  hi: [
    { value: "salaried", title: "💼 वेतनभोगी", subtitle: "नौकरी, ऑफिस स्टाफ, मासिक वेतन", icon: "wallet-outline" },
    { value: "daily_wage", title: "🛠️ दिहाड़ी मज़दूर", subtitle: "मज़दूरी, ड्राइवर, हेल्पर, रोज़ की कमाई", icon: "sunny-outline" },
    { value: "farmer_seasonal", title: "🌾 किसान / मौसमी", subtitle: "फसल या लहरों में आने वाली आय", icon: "leaf-outline" },
    { value: "business_self_employed", title: "🏪 व्यवसाय / स्वयंरोज़गार", subtitle: "दुकान, फ्रीलांस, सेवा कार्य, मिला-जुला पैसा", icon: "storefront-outline" },
    { value: "family_manager", title: "🏠 परिवार संभालने वाले", subtitle: "घर के पैसों को एक जगह रखने वाला व्यक्ति", icon: "people-outline" }
  ],
  mr: [
    { value: "salaried", title: "💼 पगारदार", subtitle: "नोकरी, ऑफिस स्टाफ, मासिक पगार", icon: "wallet-outline" },
    { value: "daily_wage", title: "🛠️ रोजंदारी कामगार", subtitle: "मजुरी, ड्रायव्हर, मदतनीस, रोजची कमाई", icon: "sunny-outline" },
    { value: "farmer_seasonal", title: "🌾 शेतकरी / मोसमी", subtitle: "पीक किंवा टप्प्याटप्प्याने येणारे उत्पन्न", icon: "leaf-outline" },
    { value: "business_self_employed", title: "🏪 व्यवसाय / स्वयंरोजगार", subtitle: "दुकान, फ्रीलान्स, सेवा काम, मिसळलेले पैसे", icon: "storefront-outline" },
    { value: "family_manager", title: "🏠 घराचा कारभारी", subtitle: "घरचे पैसे एकत्र सांभाळणारी व्यक्ती", icon: "people-outline" }
  ]
};

const incomePatternOptionsByLanguage: Record<LanguageCode, Array<{
  value: IncomePattern;
  title: string;
  subtitle: string;
  icon: string;
}>> = {
  en: [
    { value: "daily", title: "☀️ Daily", subtitle: "Money comes in most days", icon: "today-outline" },
    { value: "weekly", title: "📅 Weekly", subtitle: "Money usually comes once a week", icon: "calendar-outline" },
    { value: "monthly", title: "🧾 Monthly", subtitle: "Salary or regular monthly payout", icon: "calendar-clear-outline" },
    { value: "seasonal", title: "🌦️ Seasonal", subtitle: "Bigger money only at certain times", icon: "partly-sunny-outline" },
    { value: "mixed", title: "🔀 Mixed", subtitle: "Money comes in different ways", icon: "shuffle-outline" }
  ],
  hi: [
    { value: "daily", title: "☀️ रोज़", subtitle: "ज़्यादातर दिनों में पैसा आता है", icon: "today-outline" },
    { value: "weekly", title: "📅 हफ़्ते में", subtitle: "आमतौर पर हफ़्ते में एक बार पैसा आता है", icon: "calendar-outline" },
    { value: "monthly", title: "🧾 महीने में", subtitle: "वेतन या नियमित मासिक भुगतान", icon: "calendar-clear-outline" },
    { value: "seasonal", title: "🌦️ मौसमी", subtitle: "कुछ समय पर ही बड़ा पैसा आता है", icon: "partly-sunny-outline" },
    { value: "mixed", title: "🔀 मिला-जुला", subtitle: "पैसा अलग-अलग तरीकों से आता है", icon: "shuffle-outline" }
  ],
  mr: [
    { value: "daily", title: "☀️ रोज", subtitle: "बहुतेक दिवस पैसे येतात", icon: "today-outline" },
    { value: "weekly", title: "📅 आठवड्याला", subtitle: "साधारण आठवड्यातून एकदा पैसे येतात", icon: "calendar-outline" },
    { value: "monthly", title: "🧾 महिन्याला", subtitle: "पगार किंवा नियमित मासिक रक्कम", icon: "calendar-clear-outline" },
    { value: "seasonal", title: "🌦️ मोसमी", subtitle: "काही विशिष्ट वेळीच मोठे पैसे येतात", icon: "partly-sunny-outline" },
    { value: "mixed", title: "🔀 मिसळलेले", subtitle: "पैसे वेगवेगळ्या प्रकारे येतात", icon: "shuffle-outline" }
  ]
};

const trackingScopeOptionsByLanguage: Record<LanguageCode, Array<{
  value: TrackingScope;
  title: string;
  subtitle: string;
}>> = {
  en: [
    { value: "personal", title: "Home Only", subtitle: "Track personal or household money" },
    { value: "household", title: "Whole Household", subtitle: "See family income and spending together" }
  ],
  hi: [
    { value: "personal", title: "सिर्फ घर", subtitle: "निजी या घर का पैसा ट्रैक करें" },
    { value: "household", title: "पूरा परिवार", subtitle: "परिवार की आय और खर्च साथ देखें" }
  ],
  mr: [
    { value: "personal", title: "फक्त घर", subtitle: "वैयक्तिक किंवा घरचे पैसे पाहा" },
    { value: "household", title: "संपूर्ण कुटुंब", subtitle: "कुटुंबाची कमाई आणि खर्च एकत्र पहा" }
  ]
};

export function getUserTypeOptions(language: LanguageCode) {
  return userTypeOptionsByLanguage[language];
}

export function getIncomePatternOptions(language: LanguageCode) {
  return incomePatternOptionsByLanguage[language];
}

export function getTrackingScopeOptions(language: LanguageCode) {
  return trackingScopeOptionsByLanguage[language];
}

const moneyMixOptionsByLanguage: Record<
  LanguageCode,
  Array<{
    value: MoneyMixType;
    title: string;
    subtitle: string;
  }>
> = {
  en: [
    { value: "home", title: "Home money only", subtitle: "Business money stays separate" },
    { value: "business", title: "Business money only", subtitle: "You mainly want the business side visible" },
    { value: "mixed", title: "Home + business mixed", subtitle: "The same money is used across both" }
  ],
  hi: [
    { value: "home", title: "सिर्फ घर का पैसा", subtitle: "व्यवसाय का पैसा अलग रहता है" },
    { value: "business", title: "सिर्फ व्यवसाय का पैसा", subtitle: "अभी मुख्यतः व्यवसाय का पक्ष दिखाना है" },
    { value: "mixed", title: "घर + व्यवसाय मिला हुआ", subtitle: "एक ही पैसा दोनों जगह चलता है" }
  ],
  mr: [
    { value: "home", title: "फक्त घरचे पैसे", subtitle: "व्यवसायाचे पैसे वेगळे राहतात" },
    { value: "business", title: "फक्त व्यवसायाचे पैसे", subtitle: "आत्ता मुख्यतः व्यवसायाचा भाग दिसावा" },
    { value: "mixed", title: "घर + व्यवसाय मिसळलेले", subtitle: "एकाच पैशातून दोन्ही चालते" }
  ]
};

export function getMoneyMixOptions(language: LanguageCode) {
  return moneyMixOptionsByLanguage[language];
}
