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
  TrackingScope,
  UserType
} from "../services/api/types";

type DashboardState = {
  monthlySummary: MonthlySummaryRead | null;
  spendingSummary: SpendingInsightsResponse | null;
  insightCards: InsightCard[];
  cashflowSummary: CashflowSummary | null;
};

type OnboardingDraft = {
  displayName: string;
  userType: UserType | null;
  incomePattern: IncomePattern | null;
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

function createDefaultDraft(): OnboardingDraft {
  return {
    displayName: "MoneyOS User",
    userType: null,
    incomePattern: null,
    tracksCash: true,
    tracksLoans: false,
    tracksEmi: false,
    trackingScope: "personal",
    startCashAmount: "",
    salaryDayOfMonth: "",
    businessModeEnabled: false
  };
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
      error: null,
      userId: null,
      displayName: "MoneyOS User",
      profile: null,
      dashboard: {
        monthlySummary: null,
        spendingSummary: null,
        insightCards: [],
        cashflowSummary: null
      },
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
          let displayName = get().displayName || "MoneyOS User";
          if (!userId) {
            const login = await demoLogin({ display_name: displayName });
            userId = login.user_id;
            displayName = login.display_name;
            set({ userId, displayName });
          }

          const profile = await getProfile(userId);
          set((currentState) => ({
            profile,
            displayName,
            onboardingDraft: profile
              ? {
                  displayName,
                  userType: profile.user_type,
                  incomePattern: profile.income_pattern,
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
        const fallbackName = `MoneyOS User ${new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        })}`;

        set({
          loading: true,
          error: null,
          userId: null,
          profile: null,
          dashboard: {
            monthlySummary: null,
            spendingSummary: null,
            insightCards: [],
            cashflowSummary: null
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
          const [monthlySummary, spendingSummary, insightCards, cashflowSummary] = await Promise.all([
            getMonthlySummary(userId, year, month),
            getSpendingSummary(userId, year, month),
            listInsights(userId, year, month),
            getCashflowSummary(userId)
          ]);
          set({
            dashboard: {
              monthlySummary,
              spendingSummary,
              insightCards,
              cashflowSummary
            }
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
            business_mode_enabled: onboardingDraft.businessModeEnabled
          };

          const profile = await upsertProfile(userId, payload);
          set({ profile, displayName: payload.display_name });
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
        profile: state.profile,
        onboardingDraft: state.onboardingDraft
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
