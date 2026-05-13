import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  demoLogin,
  getCashflowSummary,
  getMonthlySummary,
  getProfile,
  getSpendingSummary,
  listInsights,
  upsertProfile
} from "../services/api/moneyos";
import type {
  CashflowSummary,
  IncomePattern,
  InsightCard,
  MonthlySummaryRead,
  ProfileOnboardingUpdate,
  ProfileRead,
  SpendingInsightsResponse,
  MoneyMixType,
  TrackingScope,
  UserType
} from "../services/api/types";
import type { LanguageCode } from "../i18n";

type DashboardState = {
  monthlySummary: MonthlySummaryRead | null;
  spendingSummary: SpendingInsightsResponse | null;
  insightCards: InsightCard[];
  cashflowSummary: CashflowSummary | null;
};

type OnboardingDraft = {
  displayName: string;
  preferredLanguage: LanguageCode;
  userType: UserType | null;
  incomePattern: IncomePattern | null;
  nextIncomeInDays: string;
  tracksCash: boolean;
  tracksLoans: boolean;
  tracksEmi: boolean;
  trackingScope: TrackingScope;
  startCashAmount: string;
  salaryDayOfMonth: string;
  businessModeEnabled: boolean;
  moneyMixType: MoneyMixType;
  receivesSalaryBesidesBusiness: boolean;
  businessReserveAmount: string;
};

type SessionStore = {
  hydrated: boolean;
  loading: boolean;
  savingOnboarding: boolean;
  onboardingCompleted: boolean;
  hasRealData: boolean;
  error: string | null;
  userId: string | null;
  displayName: string;
  profile: ProfileRead | null;
  dashboard: DashboardState;
  onboardingDraft: OnboardingDraft;
  markHydrated: () => void;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  bootstrapSession: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  saveOnboarding: () => Promise<ProfileRead>;
  startFreshDemo: () => Promise<void>;
  markHasRealData: () => void;
};

function createEmptyDashboard(): DashboardState {
  return {
    monthlySummary: null,
    spendingSummary: null,
    insightCards: [],
    cashflowSummary: null
  };
}

function createDefaultDraft(): OnboardingDraft {
  return {
    displayName: "MoneyOS User",
    preferredLanguage: "en",
    userType: null,
    incomePattern: null,
    nextIncomeInDays: "",
    tracksCash: true,
    tracksLoans: false,
    tracksEmi: false,
    trackingScope: "personal",
    startCashAmount: "",
    salaryDayOfMonth: "",
    businessModeEnabled: false,
    moneyMixType: "home",
    receivesSalaryBesidesBusiness: false,
    businessReserveAmount: ""
  };
}

function createDemoDisplayName() {
  return `MoneyOS User ${new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })}`;
}

function normalizeTrackingScope(scope: TrackingScope): TrackingScope {
  return scope === "home_and_business" ? "personal" : scope;
}

function deriveIncomePattern(userType: UserType): IncomePattern {
  switch (userType) {
    case "salaried":
      return "monthly";
    case "daily_wage":
      return "daily";
    case "farmer_seasonal":
      return "seasonal";
    case "business_self_employed":
      return "mixed";
    case "family_manager":
      return "monthly";
  }
}

function deriveNextIncomeInDays(
  userType: UserType,
  salaryDayOfMonth: string,
  receivesSalaryBesidesBusiness: boolean
): number | null {
  if ((userType === "salaried" || userType === "family_manager") && salaryDayOfMonth.trim()) {
    return null;
  }
  if (userType === "business_self_employed" && receivesSalaryBesidesBusiness && salaryDayOfMonth.trim()) {
    return null;
  }
  switch (userType) {
    case "salaried":
      return 30;
    case "daily_wage":
      return 7;
    case "farmer_seasonal":
      return 90;
    case "business_self_employed":
      return 30;
    case "family_manager":
      return 30;
  }
}

function currentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      hydrated: false,
      loading: false,
      savingOnboarding: false,
      onboardingCompleted: false,
      hasRealData: false,
      error: null,
      userId: null,
      displayName: "MoneyOS User",
      profile: null,
      dashboard: createEmptyDashboard(),
      onboardingDraft: createDefaultDraft(),
      markHydrated: () => set({ hydrated: true }),
      markHasRealData: () => set({ hasRealData: true }),
      setDraft: (patch) =>
        set((state) => ({
          onboardingDraft: {
            ...state.onboardingDraft,
            ...patch
          }
        })),
      bootstrapSession: async () => {
        const state = get();
        if (state.loading) {
          return;
        }
        set({ loading: true, error: null });
        try {
          // Always start fresh on app launch - clear persisted userId and profile, force onboarding
          let userId: string | null = null;
          let displayName = createDemoDisplayName();

          set((state) => ({
            displayName,
            userId: null,
            profile: null,
            onboardingCompleted: false,
            hasRealData: false,
            dashboard: createEmptyDashboard(),
            onboardingDraft: {
              ...createDefaultDraft(),
              displayName
            }
          }));

          const login = await demoLogin({ display_name: displayName, force_new: true });
          userId = login.user_id;
          displayName = login.display_name;
          set({ userId, displayName });

          const profile = await getProfile(userId);
          set((currentState) => ({
            profile,
            displayName,
            onboardingCompleted: currentState.onboardingCompleted && Boolean(profile),
            onboardingDraft: profile
              ? {
                  displayName,
                  preferredLanguage: currentState.onboardingDraft.preferredLanguage,
                  userType: profile.user_type,
                  incomePattern: profile.income_pattern,
                  nextIncomeInDays: profile.next_income_in_days ? String(profile.next_income_in_days) : "",
                  tracksCash: profile.tracks_cash,
                  tracksLoans: profile.tracks_loans,
                  tracksEmi: profile.tracks_emi,
                  trackingScope: normalizeTrackingScope(profile.tracking_scope),
                  startCashAmount: profile.start_cash_amount ? String(profile.start_cash_amount) : "",
                  salaryDayOfMonth: profile.salary_day_of_month ? String(profile.salary_day_of_month) : "",
                  businessModeEnabled: profile.business_mode_enabled,
                  moneyMixType: profile.money_mix_type,
                  receivesSalaryBesidesBusiness: profile.receives_salary_besides_business,
                  businessReserveAmount: profile.business_reserve_amount ? String(profile.business_reserve_amount) : ""
                }
              : currentState.onboardingDraft
          }));

          if (profile) {
            await get().refreshDashboard();
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not start your session." });
        } finally {
          set({ loading: false });
        }
      },
      startFreshDemo: async () => {
        const fallbackName = createDemoDisplayName();

        set({
          loading: true,
          error: null,
          onboardingCompleted: false,
          hasRealData: false,
          userId: null,
          profile: null,
          dashboard: {
            ...createEmptyDashboard()
          },
          displayName: fallbackName,
          onboardingDraft: {
              ...createDefaultDraft(),
              displayName: fallbackName
            }
        });

        try {
          await AsyncStorage.removeItem("moneyos-session");
          const login = await demoLogin({
            display_name: fallbackName,
            force_new: true
          });

          set({
            userId: login.user_id,
            displayName: login.display_name,
            onboardingDraft: {
              ...createDefaultDraft(),
              displayName: login.display_name
            }
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not start a fresh demo." });
          throw error;
        } finally {
          set({ loading: false });
        }
      },
      refreshDashboard: async () => {
        const { userId } = get();
        if (!userId) {
          return;
        }
        try {
          const { year, month } = currentPeriod();
          const cashflowSummary = await getCashflowSummary(userId);
          const [monthlySummaryResult, spendingSummaryResult, insightCardsResult] = await Promise.allSettled([
            getMonthlySummary(userId, year, month),
            getSpendingSummary(userId, year, month),
            listInsights(userId, year, month)
          ]);

          const optionalErrors = [monthlySummaryResult, spendingSummaryResult, insightCardsResult].filter(
            (result): result is PromiseRejectedResult => result.status === "rejected"
          );

          set({
            dashboard: {
              monthlySummary: monthlySummaryResult.status === "fulfilled" ? monthlySummaryResult.value : null,
              spendingSummary: spendingSummaryResult.status === "fulfilled" ? spendingSummaryResult.value : null,
              insightCards: insightCardsResult.status === "fulfilled" ? insightCardsResult.value : [],
              cashflowSummary
            },
            error: optionalErrors.length
              ? "Some secondary insights could not refresh, but your main cashflow answer is up to date."
              : null
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not load the dashboard." });
        }
      },
      saveOnboarding: async () => {
        const { userId, onboardingDraft } = get();
        if (!userId) {
          throw new Error("Missing demo session.");
        }
        if (!onboardingDraft.userType) {
          throw new Error("Please finish the setup first.");
        }

        const derivedIncomePattern = deriveIncomePattern(onboardingDraft.userType);
        const derivedNextIncomeInDays = deriveNextIncomeInDays(
          onboardingDraft.userType,
          onboardingDraft.salaryDayOfMonth,
          onboardingDraft.receivesSalaryBesidesBusiness
        );

        set({ savingOnboarding: true, error: null });
        try {
          const payload: ProfileOnboardingUpdate = {
            display_name: onboardingDraft.displayName || "MoneyOS User",
            user_type: onboardingDraft.userType,
            income_pattern: derivedIncomePattern,
            tracks_cash: onboardingDraft.tracksCash,
            tracks_loans: onboardingDraft.tracksLoans,
            tracks_emi: onboardingDraft.tracksEmi,
            tracking_scope: normalizeTrackingScope(onboardingDraft.trackingScope),
            start_cash_amount: onboardingDraft.startCashAmount ? Number(onboardingDraft.startCashAmount) : null,
            salary_day_of_month: onboardingDraft.salaryDayOfMonth ? Number(onboardingDraft.salaryDayOfMonth) : null,
            next_income_in_days: derivedNextIncomeInDays,
            business_mode_enabled: onboardingDraft.businessModeEnabled || onboardingDraft.userType === "business_self_employed",
            money_mix_type: onboardingDraft.moneyMixType,
            receives_salary_besides_business: onboardingDraft.receivesSalaryBesidesBusiness,
            business_reserve_amount: onboardingDraft.businessReserveAmount ? Number(onboardingDraft.businessReserveAmount) : null
          };

          const profile = await upsertProfile(userId, payload);
          set({
            profile,
            onboardingCompleted: true,
            displayName: payload.display_name
          });
          await get().refreshDashboard();
          return profile;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not save your setup." });
          throw error;
        } finally {
          set({ savingOnboarding: false });
        }
      }
    }),
    {
      name: "moneyos-session",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        userId: state.userId,
        displayName: state.displayName,
        onboardingCompleted: state.onboardingCompleted,
        hasRealData: state.hasRealData,
        profile: state.profile,
        onboardingDraft: state.onboardingDraft
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
