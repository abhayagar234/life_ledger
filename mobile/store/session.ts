import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  demoLogin,
  getCashflowSummary,
  getMonthlySummary,
  getProfile,
  getSpendingSummary,
  loadSampleStatement,
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
};

type SessionStore = {
  hydrated: boolean;
  loading: boolean;
  savingOnboarding: boolean;
  onboardingCompleted: boolean;
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
    businessModeEnabled: false
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
      error: null,
      userId: null,
      displayName: "MoneyOS User",
      profile: null,
      dashboard: createEmptyDashboard(),
      onboardingDraft: createDefaultDraft(),
      markHydrated: () => set({ hydrated: true }),
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
          let userId = get().userId;
          let displayName = get().displayName || createDemoDisplayName();
          if (!userId) {
            if (!get().displayName || get().displayName === "MoneyOS User") {
              set((state) => ({
                displayName,
                onboardingDraft: {
                  ...state.onboardingDraft,
                  displayName
                }
              }));
            }
            const login = await demoLogin({ display_name: displayName });
            userId = login.user_id;
            displayName = login.display_name;
            set({ userId, displayName });
          }

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
                  trackingScope: profile.tracking_scope,
                  startCashAmount: profile.start_cash_amount ? String(profile.start_cash_amount) : "",
                  salaryDayOfMonth: profile.salary_day_of_month ? String(profile.salary_day_of_month) : "",
                  businessModeEnabled: profile.business_mode_enabled
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
        if (!onboardingDraft.userType || !onboardingDraft.incomePattern) {
          throw new Error("Please finish the setup first.");
        }

        set({ savingOnboarding: true, error: null });
        try {
          const payload: ProfileOnboardingUpdate = {
            display_name: onboardingDraft.displayName || "MoneyOS User",
            user_type: onboardingDraft.userType,
            income_pattern: onboardingDraft.incomePattern,
            tracks_cash: onboardingDraft.tracksCash,
            tracks_loans: onboardingDraft.tracksLoans,
            tracks_emi: onboardingDraft.tracksEmi,
            tracking_scope: onboardingDraft.trackingScope,
            start_cash_amount: onboardingDraft.startCashAmount ? Number(onboardingDraft.startCashAmount) : null,
            salary_day_of_month: onboardingDraft.salaryDayOfMonth ? Number(onboardingDraft.salaryDayOfMonth) : null,
            next_income_in_days: onboardingDraft.nextIncomeInDays ? Number(onboardingDraft.nextIncomeInDays) : null,
            business_mode_enabled: onboardingDraft.businessModeEnabled
          };

          const profile = await upsertProfile(userId, payload);
          set({
            profile,
            onboardingCompleted: true,
            displayName: payload.display_name
          });
          await loadSampleStatement(userId);
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
        profile: state.profile,
        onboardingDraft: state.onboardingDraft
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
