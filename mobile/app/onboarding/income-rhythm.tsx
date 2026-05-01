import { router } from "expo-router";
import { useMemo } from "react";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { getIncomePatternOptions } from "../../features/onboarding/options";
import { t } from "../../i18n";
import { useSessionStore } from "../../store/session";

export default function IncomeRhythmScreen() {
  const selected = useSessionStore((state) => state.onboardingDraft.incomePattern);
  const userType = useSessionStore((state) => state.onboardingDraft.userType);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const setDraft = useSessionStore((state) => state.setDraft);
  const incomePatternOptions = getIncomePatternOptions(language);
  const subtitle = useMemo(() => {
    if (userType === "daily_wage") {
      return t(language, "incomeDailySubtitle");
    }
    if (userType === "farmer_seasonal") {
      return t(language, "incomeFarmerSubtitle");
    }
    if (userType === "business_self_employed") {
      return t(language, "incomeBusinessSubtitle");
    }
    return t(language, "incomeDefaultSubtitle");
  }, [language, userType]);

  return (
    <AppScreen
      title={t(language, "incomeTitle")}
      subtitle={subtitle}
    >
      {incomePatternOptions.map((option) => (
        <ChoiceCard
          key={option.value}
          title={option.title}
          subtitle={option.subtitle}
          icon={option.icon}
          selected={selected === option.value}
          onPress={() =>
            setDraft({
              incomePattern: option.value,
              salaryDayOfMonth: option.value === "monthly" ? "" : ""
            })
          }
        />
      ))}
      <Button label={t(language, "continue")} onPress={() => router.push("/onboarding/next-money")} disabled={!selected} />
    </AppScreen>
  );
}
