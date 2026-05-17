import type {
  InsightCard,
  MonthlySummaryRead,
  ProfileRead,
  SpendingInsightsResponse,
  UserType
} from "../../services/api/types";

type MetricCard = {
  label: string;
  value: string;
  helper: string;
};

type QuickAction = {
  label: string;
  icon: string;
  hint: string;
};

export type DashboardContent = {
  heroTitle: string;
  heroSubtitle: string;
  primaryMetric: MetricCard;
  secondaryMetrics: MetricCard[];
  quickActions: QuickAction[];
  highlightTitle: string;
  highlightBody: string;
  alerts: string[];
};

function formatMoney(amount: number | null | undefined) {
  const safeAmount = Math.round(amount ?? 0);
  return `₹${safeAmount.toLocaleString("en-IN")}`;
}

function resolveUserType(profile?: ProfileRead | null): UserType {
  return profile?.user_type ?? "salaried";
}

export function buildDashboardContent(params: {
  profile?: ProfileRead | null;
  summary?: MonthlySummaryRead | null;
  insights?: SpendingInsightsResponse | null;
  coachCards?: InsightCard[];
}): DashboardContent {
  const { profile, summary, insights, coachCards = [] } = params;
  const userType = resolveUserType(profile);
  const primaryInsight = summary?.primary_insight ?? coachCards[0]?.message ?? "Add a few entries to unlock a useful money snapshot.";

  const base = {
    alerts: coachCards.slice(0, 3).map((card) => card.message),
    highlightTitle: coachCards[0]?.title ?? "MoneyOS Tip",
    highlightBody: primaryInsight
  };

  if (userType === "daily_wage" || userType === "farmer_seasonal") {
    return {
      ...base,
      heroTitle: userType === "daily_wage" ? "Track today's money with confidence" : "Stretch this season's money calmly",
      heroSubtitle:
        userType === "daily_wage"
          ? "See what came in, what went out, and what cash is still safe."
          : "Keep home spend, work spend, and dues visible in one place.",
      primaryMetric: {
        label: userType === "daily_wage" ? "Cash Left" : "Money Left",
        value: formatMoney(insights?.safe_to_spend ?? summary?.income_total ?? 0),
        helper: userType === "daily_wage" ? "safe for now" : "after essentials"
      },
      secondaryMetrics: [
        {
          label: userType === "daily_wage" ? "Recent Income" : "Recent Income",
          value: formatMoney(insights?.monthly_income ?? summary?.income_total ?? 0),
          helper: "last 30 days"
        },
        {
          label: "Runway",
          value: insights?.runway_days ? `${Math.round(insights.runway_days)} days` : "Estimate soon",
          helper: "protect essentials first"
        }
      ],
      quickActions: [
        { label: "Earned Today", icon: "add-circle-outline", hint: "log income fast" },
        { label: "Spent Cash", icon: "remove-circle-outline", hint: "track quick spending" },
        { label: "Add Loan", icon: "document-text-outline", hint: "money due or borrowed" },
        { label: "Set Cash", icon: "wallet-outline", hint: "update wallet or home cash" }
      ]
    };
  }

  if (userType === "business_self_employed") {
    return {
      ...base,
      heroTitle: "See money in, money out, and what is due",
      heroSubtitle: "A clear cash view for home and business without full accounting.",
      primaryMetric: {
        label: "Money In",
        value: formatMoney(insights?.monthly_income ?? summary?.income_total ?? 0),
        helper: "this period"
      },
      secondaryMetrics: [
        {
          label: "Money Out",
          value: formatMoney(insights?.total_spend ?? summary?.expense_total ?? 0),
          helper: "business + home"
        },
        {
          label: "Safe To Spend",
          value: formatMoney(insights?.safe_to_spend ?? 0),
          helper: "after reserves"
        }
      ],
      quickActions: [
        { label: "Add Sale", icon: "trending-up-outline", hint: "record money in" },
        { label: "Add Expense", icon: "cart-outline", hint: "track costs" },
        { label: "Add Due", icon: "receipt-outline", hint: "owed or payable" },
        { label: "Set Cash", icon: "wallet-outline", hint: "sync cash on hand" }
      ]
    };
  }

  return {
    ...base,
    heroTitle: "Know what is safe before the month gets tight",
    heroSubtitle: "Track salary, spending, cash, and dues in one calm dashboard.",
    primaryMetric: {
      label: "Safe To Spend",
      value: formatMoney(insights?.safe_to_spend ?? 0),
      helper: profile?.salary_day_of_month ? `before salary day ${profile.salary_day_of_month}` : "before next income"
    },
    secondaryMetrics: [
      {
        label: "Month Spent",
        value: formatMoney(insights?.total_spend ?? summary?.expense_total ?? 0),
        helper: "this month"
      },
      {
        label: "Fixed Dues",
        value: formatMoney(insights?.fixed_obligations_total ?? summary?.emi_due_total ?? 0),
        helper: "rent, EMI, bills"
      }
    ],
    quickActions: [
      { label: "Add Expense", icon: "remove-circle-outline", hint: "daily spending" },
      { label: "Add Income", icon: "add-circle-outline", hint: "salary or extra income" },
      { label: "Set Cash", icon: "wallet-outline", hint: "wallet and home cash" },
      { label: "Add EMI", icon: "calendar-outline", hint: "bill or payment due" }
    ]
  };
}
