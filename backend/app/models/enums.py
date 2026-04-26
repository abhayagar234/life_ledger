from enum import Enum


class UserType(str, Enum):
    SALARIED = "salaried"
    DAILY_WAGE = "daily_wage"
    FARMER_SEASONAL = "farmer_seasonal"
    BUSINESS_SELF_EMPLOYED = "business_self_employed"
    FAMILY_MANAGER = "family_manager"


class IncomePattern(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    SEASONAL = "seasonal"
    MIXED = "mixed"


class TrackingScope(str, Enum):
    PERSONAL = "personal"
    HOUSEHOLD = "household"
    HOME_AND_BUSINESS = "home_and_business"


class EntryType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"
    CASH_ADJUSTMENT = "cash_adjustment"
    LOAN_DISBURSAL = "loan_disbursal"
    LOAN_REPAYMENT = "loan_repayment"
    INTEREST_CHARGE = "interest_charge"
    EMI_PAYMENT = "emi_payment"


class AccountType(str, Enum):
    CASH = "cash"
    BANK = "bank"
    WALLET = "wallet"
    CARD = "card"
    OTHER = "other"


class CashDirection(str, Enum):
    IN_ = "in"
    OUT = "out"
    SET = "set"
    ADJUST = "adjust"


class LoanType(str, Enum):
    BORROWED = "borrowed"
    LENT = "lent"
    INFORMAL_DUE = "informal_due"


class InterestType(str, Enum):
    NONE = "none"
    FLAT = "flat"
    MONTHLY_PERCENT = "monthly_percent"
    ANNUAL_PERCENT = "annual_percent"


class EMIFrequency(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class LoanStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    OVERDUE = "overdue"


class EMIPaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    PARTIAL = "partial"
    MISSED = "missed"


class BudgetPeriodType(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    SEASONAL = "seasonal"
    CUSTOM = "custom"


class BudgetStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class GoalType(str, Enum):
    SAVINGS = "savings"
    DEBT_PAYOFF = "debt_payoff"
    EDUCATION = "education"
    MEDICAL = "medical"
    FESTIVAL = "festival"
    BUSINESS = "business"
    OTHER = "other"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    ACHIEVED = "achieved"
    PAUSED = "paused"
    CANCELLED = "cancelled"
