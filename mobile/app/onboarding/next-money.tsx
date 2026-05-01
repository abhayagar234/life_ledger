import { router } from "expo-router";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { t } from "../../i18n";
import { useSessionStore } from "../../store/session";

const horizonOptions = [
  { value: "3", key: "nextMoney3", icon: "time-outline" },
  { value: "7", key: "nextMoney7", icon: "calendar-outline" },
  { value: "15", key: "nextMoney15", icon: "calendar-number-outline" },
  { value: "30", key: "nextMoney30", icon: "today-outline" },
  { value: "60", key: "nextMoney60", icon: "trail-sign-outline" },
  { value: "90", key: "nextMoney90", icon: "map-outline" },
  { value: "180", key: "nextMoney180", icon: "hourglass-outline" }
] as const;

export default function NextMoneyScreen() {
  const selected = useSessionStore((state) => state.onboardingDraft.nextIncomeInDays);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const setDraft = useSessionStore((state) => state.setDraft);

  return (
    <AppScreen title={t(language, "nextMoneyTitle")} subtitle={t(language, "nextMoneySubtitle")}>
      {horizonOptions.map((option) => (
        <ChoiceCard
          key={option.value}
          title={t(language, option.key)}
          subtitle=""
          icon={option.icon}
          selected={selected === option.value}
          onPress={() => setDraft({ nextIncomeInDays: option.value })}
        />
      ))}
      <Button label={t(language, "continue")} onPress={() => router.push("/onboarding/cash-setup")} disabled={!selected} />
    </AppScreen>
  );
}
