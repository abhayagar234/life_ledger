import { Stack } from "expo-router";
import { useEffect } from "react";

import { useSessionStore } from "../store/session";
import { theme } from "../theme";

export default function RootLayout() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);

  useEffect(() => {
    if (hydrated) {
      void bootstrapSession();
    }
  }, [bootstrapSession, hydrated]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg }
      }}
    />
  );
}
