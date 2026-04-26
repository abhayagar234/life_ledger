import { router } from "expo-router";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { ChoiceCard } from "../../components/ChoiceCard";

export default function CsvImportScreen() {
  return (
    <AppScreen title="Start with statement history?" subtitle="Statement data does the heavy lifting first.">
      <ChoiceCard
        title="Use sample statement after setup"
        subtitle="Recommended. We will save your setup first, then load a realistic example automatically."
        icon="cloud-upload-outline"
        onPress={() => router.push("/onboarding/complete")}
      />
      <ChoiceCard
        title="Do it later"
        subtitle="You can still finish setup and add cash updates first."
        icon="arrow-forward-outline"
        onPress={() => router.push("/onboarding/complete")}
      />
      <Button label="Continue Setup" onPress={() => router.push("/onboarding/complete")} />
    </AppScreen>
  );
}
