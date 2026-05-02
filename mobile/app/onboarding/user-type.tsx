import { router } from "expo-router";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { getUserTypeOptions } from "../../features/onboarding/options";
import { t } from "../../i18n";
import type { IncomePattern, UserType } from "../../services/api/types";
import { useSessionStore } from "../../store/session";

function defaultsForUserType(userType: UserType): { incomePattern: IncomePattern; nextIncomeInDays: string } {
  switch (userType) {
    case "salaried":
      return { incomePattern: "monthly", nextIncomeInDays: "30" };
    case "daily_wage":
      return { incomePattern: "daily", nextIncomeInDays: "7" };
    case "farmer_seasonal":
      return { incomePattern: "seasonal", nextIncomeInDays: "90" };
    case "business_self_employed":
      return { incomePattern: "mixed", nextIncomeInDays: "30" };
    case "family_manager":
      return { incomePattern: "monthly", nextIncomeInDays: "30" };
  }
}

export default function UserTypeScreen() {
  const selected = useSessionStore((state) => state.onboardingDraft.userType);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const setDraft = useSessionStore((state) => state.setDraft);
  const userTypeOptions = getUserTypeOptions(language);

  return (
    <AppScreen
      title={t(language, "userTypeTitle")}
      subtitle={t(language, "userTypeSubtitle")}
    >
      {userTypeOptions.map((option) => (
        <ChoiceCard
          key={option.value}
          title={option.title}
          subtitle={option.subtitle}
          icon={option.icon}
          selected={selected === option.value}
          onPress={() => {
            const defaults = defaultsForUserType(option.value);
            setDraft({
              userType: option.value,
              incomePattern: defaults.incomePattern,
              nextIncomeInDays: defaults.nextIncomeInDays,
              businessModeEnabled: option.value === "business_self_employed",
              trackingScope: "personal",
              salaryDayOfMonth: ""
            });
          }}
        />
      ))}
      <Button label={t(language, "continue")} onPress={() => router.push("/onboarding/cash-setup")} disabled={!selected} />
    </AppScreen>
  );
}
