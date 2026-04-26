import type { ExpoConfig } from "expo/config";

const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT ?? "dev";
const isProduction = appVariant === "production";
const isPreview = appVariant === "preview";

const appName = isProduction ? "Life Ledger MoneyOS" : isPreview ? "MoneyOS Preview" : "MoneyOS Dev";
const slug = "life-ledger-moneyos";
const scheme = isProduction ? "moneyos" : `moneyos-${appVariant}`;

const bundleSuffix = isProduction ? "" : `.${appVariant}`;

const config: ExpoConfig = {
  name: appName,
  slug,
  scheme,
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  assetBundlePatterns: ["**/*"],
  experiments: {
    typedRoutes: true
  },
  plugins: ["expo-router"],
  android: {
    package: `com.lifeledger.moneyos${bundleSuffix}`,
    adaptiveIcon: {
      backgroundColor: "#F5EFE6"
    }
  },
  ios: {
    bundleIdentifier: `com.lifeledger.moneyos${bundleSuffix}`,
    supportsTablet: false
  },
  extra: {
    appVariant,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"
  }
};

export default config;
