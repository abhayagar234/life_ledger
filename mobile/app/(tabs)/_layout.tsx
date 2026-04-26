import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { theme } from "../../theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "Setup",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
