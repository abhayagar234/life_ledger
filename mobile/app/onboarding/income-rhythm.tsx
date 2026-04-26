import { router } from "expo-router";
import { useMemo } from "react";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { incomePatternOptions } from "../../features/onboarding/options";
import { useSessionStore } from "../../store/session";

export default function IncomeRhythmScreen() {
  const selected = useSessionStore((state) => state.onboardingDraft.incomePattern);
  const userType = useSessionStore((state) => state.onboardingDraft.userType);
  const setDraft = useSessionStore((state) => state.setDraft);
  const subtitle = useMemo(() => {
    if (userType === "daily_wage") {
      return "Pick the rhythm that feels closest to how work money usually comes in.";
    }
    if (userType === "farmer_seasonal") {
      return "Choose the pattern that matches harvest, contract, or seasonal income.";
    }
    if (userType === "business_self_employed") {
      return "This helps us handle shop sales, side income, and uneven cashflow better.";
    }
    return "This helps us show the right summary and reminders.";
  }, [userType]);

  return (
    <AppScreen
      title="How does money usually come in?"
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
      <Button label="Continue" onPress={() => router.push("/onboarding/cash-setup")} disabled={!selected} />
    </AppScreen>
  );
}
