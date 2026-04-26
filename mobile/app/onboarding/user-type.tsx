import { router } from "expo-router";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { userTypeOptions } from "../../features/onboarding/options";
import { useSessionStore } from "../../store/session";

export default function UserTypeScreen() {
  const selected = useSessionStore((state) => state.onboardingDraft.userType);
  const setDraft = useSessionStore((state) => state.setDraft);

  return (
    <AppScreen
      title="What fits you best?"
      subtitle="We will show the right home screen and shortcuts for you."
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
      <Button label="Continue" onPress={() => router.push("/onboarding/income-rhythm")} disabled={!selected} />
    </AppScreen>
  );
}
