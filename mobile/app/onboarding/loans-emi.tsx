import { router } from "expo-router";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";
import { useSessionStore } from "../../store/session";

export default function LoansSetupScreen() {
  const draft = useSessionStore((state) => state.onboardingDraft);
  const setDraft = useSessionStore((state) => state.setDraft);

  return (
    <AppScreen title="Do you want to track loans or EMI?" subtitle="This helps you see what is due and what is pending.">
      <ChoiceCard
        title="Yes, show dues on home"
        subtitle="Track borrowed money, lent money, and EMI reminders."
        icon="receipt-outline"
        selected={draft.tracksLoans || draft.tracksEmi}
        onPress={() => setDraft({ tracksLoans: true, tracksEmi: true })}
      />
      <ChoiceCard
        title="Later"
        subtitle="You can add loans and EMI after setup too."
        icon="time-outline"
        selected={!draft.tracksLoans && !draft.tracksEmi}
        onPress={() => setDraft({ tracksLoans: false, tracksEmi: false })}
      />
      <Button label="Continue" onPress={() => router.push("/onboarding/csv-import")} />
    </AppScreen>
  );
}
