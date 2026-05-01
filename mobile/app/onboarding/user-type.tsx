import { router } from "expo-router";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { getUserTypeOptions } from "../../features/onboarding/options";
import { t } from "../../i18n";
import { useSessionStore } from "../../store/session";

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
          onPress={() =>
            setDraft({
              userType: option.value,
              businessModeEnabled: option.value === "business_self_employed",
              trackingScope: option.value === "business_self_employed" ? "home_and_business" : "personal",
              salaryDayOfMonth: ""
            })
          }
        />
      ))}
      <Button label={t(language, "continue")} onPress={() => router.push("/onboarding/income-rhythm")} disabled={!selected} />
    </AppScreen>
  );
}
