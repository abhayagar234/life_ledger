import { Redirect } from "expo-router";

import { AppScreen } from "../components/AppScreen";
import { EmptyStateCard } from "../components/EmptyStateCard";
import { useSessionStore } from "../store/session";

export default function IndexScreen() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const loading = useSessionStore((state) => state.loading);
  const profile = useSessionStore((state) => state.profile);
  const error = useSessionStore((state) => state.error);

  if (!hydrated || loading) {
    return (
      <AppScreen title="Starting MoneyOS" subtitle="Preparing your demo workspace.">
        <EmptyStateCard title="One moment" body="We are loading your setup and the latest dashboard." />
      </AppScreen>
    );
  }

  if (error && !profile) {
    return (
      <AppScreen title="MoneyOS" subtitle="Your data is safe. Try again or check the API connection.">
        <EmptyStateCard title="Could not connect" body={error} />
      </AppScreen>
    );
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
