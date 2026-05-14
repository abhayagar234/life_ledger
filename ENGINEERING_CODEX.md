# MoneyOS Engineering Codex

**Status:** Pre-MVP Phase 1
**Last Updated:** 2026-05-08
**Document Owner:** Engineering Team

---

## EXECUTIVE SUMMARY

MoneyOS is a financial clarity app for India's underbanked (₹10K-50K monthly income). The engineering architecture must solve:

1. **Cash + Digital unification** — Single source of truth for mixed payment methods
2. **Real-time cashflow calculation** — Safe-to-spend number updates within seconds
3. **Behavioral data capture** — WhatsApp-driven daily confirmation without app fatigue
4. **Partner integrations** — Insurance, lending, gig work referrals without building full products
5. **Low-bandwidth operations** — WhatsApp primary, SMS fallback (users may be on 2G)
6. **Regional compliance** — Multi-language, multi-currency, government scheme awareness

---

## PART 1: WHAT'S ALREADY IMPLEMENTED

### Backend (FastAPI + SQLAlchemy)

**Completed:**
```
✅ User model (id, phone, email, display_name, is_active)
✅ Financial profile (income_pattern, user_type, salary_day, next_income_days)
✅ Transaction model (NormalizedTransaction: 30+ fields)
✅ Ledger entries (manual cash/UPI/credit entries)
✅ EMI payments (recurring obligations)
✅ Loans model (formal + informal, tracking)
✅ Upcoming dues (recurring manual dues)
✅ CSV import pipeline (XLSX, XLS, CSV parsing)
✅ Categorization engine (heuristic-based, 20+ categories)
✅ Cashflow summary engine (749 lines, sophisticated calculation)
✅ Auth stub (/demo-login, not real)
✅ Profile CRUD endpoints
✅ Ledger CRUD endpoints
✅ Cashflow summary calculation
✅ Sample data seeding (persona-based)
✅ Database migrations (SQLAlchemy)
✅ Tests (basic coverage)
✅ Account Aggregator foundation (not integrated)
```

**Routes implemented:**
- `/auth/demo-login` → Creates demo user, seeds sample data
- `/profiles/me` → Get/update user profile
- `/cashflow/summary` → Core calculation
- `/ledger-entries` → Add/list manual entries
- `/upcoming-dues` → Create/list dues
- `/imports/files` → CSV upload
- `/emi-payments`, `/loans`, `/budgets`, `/goals` (CRUD, not core)

**Architecture strengths:**
- Clean separation of concerns (models → schemas → services → routes)
- Rule-based cashflow calculation (transparent, not black-box)
- Proper database relationships and cascades
- Multi-profile sample data seeding
- PostgreSQL-ready (currently SQLite dev)

---

### Mobile (React Native + Expo)

**Completed:**
```
✅ Onboarding flow (language → user type → cash setup → name)
✅ Home screen (fuel gauge, hero number, data health line)
✅ Manual entry screen (cash/UPI/credit/split)
✅ Add upcoming due screen
✅ Import statement screen
✅ Multi-language support (EN, HI, MR via i18n)
✅ Zustand state management (session store)
✅ Theme system (colors, spacing)
✅ Navigation (Expo Router)
✅ Components (Button, Card, AppScreen, EmptyState)
✅ Safe area handling
✅ AsyncStorage for persistence
```

**Screens:**
- `/onboarding` → Language, user type, cash, name
- `/` → Home with cashflow summary
- `/add-entry` → Manual transaction entry
- `/add-upcoming-due` → Create upcoming due
- `/import-statement` → CSV upload
- `/(tabs)` → Tab navigation (home, insights, loans, you)

**Architecture strengths:**
- Mobile-first design
- Proper TypeScript typing
- Localization architecture (easy to add languages)
- State management isolated to Zustand
- No hardcoded strings (all via i18n)

---

## PART 2: CRITICAL GAPS (Fix Immediately)

### 1. Authentication is a Stub (Critical)

**Current state:**
```typescript
// This is what exists:
POST /auth/demo-login
{
  display_name: string
  phone_number?: string
  force_new?: boolean
}
// Creates user without any security
// No verification, no session, no tokens
```

**Problems:**
- Anyone can access any user's data (no user validation in endpoints)
- No real OTP/email verification
- No token-based auth
- Render-deployed app is PUBLIC with zero access control

**Must implement:**

```python
# Backend: Real auth flow

# models/auth.py
class OTPSession(Base):
    __tablename__ = "otp_sessions"
    id: UUID
    phone_number: str  # +91XXXXXXXXXX
    email: str
    otp_code: str  # 6-digit
    otp_attempts: int = 0
    max_attempts: int = 3
    created_at: datetime
    expires_at: datetime  # 5 minutes
    is_verified: bool = False
    user_id: UUID  # After verification

class UserSession(Base):
    __tablename__ = "user_sessions"
    id: UUID
    user_id: UUID
    access_token: str  # JWT
    refresh_token: str  # JWT
    token_expiry: datetime
    device_id: str
    ip_address: str
    created_at: datetime
    is_active: bool = True

# routes/auth.py
@router.post("/request-otp")
def request_otp(phone_or_email: str):
    """
    1. Validate phone (starts with +91) or email
    2. Check if user exists
    3. Generate 6-digit OTP
    4. Send via SMS (Twilio) or Email (SendGrid)
    5. Create OTPSession with 5-min expiry
    6. Return: { otp_session_id, expires_in_seconds }
    """
    pass

@router.post("/verify-otp")
def verify_otp(otp_session_id: UUID, otp_code: str):
    """
    1. Get OTPSession
    2. Check expiry
    3. Check attempts (<3)
    4. Verify OTP matches
    5. If user doesn't exist, create
    6. Create UserSession
    7. Return: { user_id, access_token, refresh_token }
    """
    pass

@router.post("/refresh-token")
def refresh_token(refresh_token: str):
    """
    1. Validate refresh token (JWT signature)
    2. Check if not revoked
    3. Generate new access token
    4. Return: { access_token }
    """
    pass

@router.get("/me")
@require_auth
def get_current_user(current_user: User = Depends(get_current_user)):
    """Protected endpoint, only works with valid JWT"""
    return current_user
```

```typescript
// Mobile: OTP flow

// services/auth.ts
const authService = {
  async requestOTP(phoneOrEmail: string) {
    const response = await api.post("/auth/request-otp", {
      phone_or_email: phoneOrEmail
    })
    return {
      otpSessionId: response.otp_session_id,
      expiresIn: response.expires_in_seconds
    }
  },

  async verifyOTP(otpSessionId: string, otp: string) {
    const response = await api.post("/auth/verify-otp", {
      otp_session_id: otpSessionId,
      otp_code: otp
    })
    await secureStorage.setItem("access_token", response.access_token)
    await secureStorage.setItem("refresh_token", response.refresh_token)
    return response.user_id
  }
}

// screens/auth/otp.tsx
export default function OTPScreen() {
  const [phone, setPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(0)
  
  const handleRequestOTP = async () => {
    const { otpSessionId, expiresIn } = await authService.requestOTP(phone)
    setSessionId(otpSessionId)
    setSecondsLeft(expiresIn)
    // Start countdown
  }
  
  const handleVerifyOTP = async () => {
    const userId = await authService.verifyOTP(sessionId, otpCode)
    router.replace("/(tabs)/home")
  }
  
  return (
    <AppScreen title="Verify Phone">
      {!sessionId ? (
        <>
          <TextInput
            placeholder="+91XXXXXXXXXX"
            value={phone}
            onChangeText={setPhone}
          />
          <Button onPress={handleRequestOTP}>Send OTP</Button>
        </>
      ) : (
        <>
          <Text>{secondsLeft} seconds left</Text>
          <OTPInput
            length={6}
            value={otpCode}
            onChangeText={setOtpCode}
          />
          <Button onPress={handleVerifyOTP}>Verify</Button>
        </>
      )}
    </AppScreen>
  )
}
```

**Timeline:** Week 1 (non-negotiable)

---

### 2. WhatsApp Bot Not Implemented (Critical)

**Current state:**
- Mobile app shows balance
- But no push notification or reminder

**Must implement:**

```python
# backend/app/services/whatsapp_bot.py

from twilio.rest import Client

class WhatsAppBotService:
    def __init__(self):
        self.client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        self.WHATSAPP_FROM = "whatsapp:+1XXXXX"  # Twilio number
    
    async def send_daily_confirmation_message(self, user: User):
        """
        Send at 9 PM: "Hey, did you spend any cash today?"
        Expect user to reply: "500" or "no"
        """
        profile = user.financial_profile
        latest_cash = profile.start_cash_amount or 0
        
        message = (
            f"Hey {profile.display_name}! 💰\n\n"
            f"Quick check: How much cash on hand today?\n"
            f"(Reply with amount, e.g., '₹1500' or '1500')"
        )
        
        phone_with_prefix = f"whatsapp:+91{user.phone_number.lstrip('0')}"
        
        self.client.messages.create(
            from_=self.WHATSAPP_FROM,
            to=phone_with_prefix,
            body=message
        )
    
    async def handle_inbound_message(self, phone: str, message_text: str):
        """
        Webhook: Receive inbound WhatsApp message
        Parse the message, update cash balance
        """
        user = db.query(User).filter(
            User.phone_number == phone
        ).first()
        
        if not user:
            return  # User doesn't exist
        
        # Parse amount from message
        # Examples: "500", "₹500", "1500 cash", "no cash today"
        
        if message_text.lower() in ["no", "none", "0", "nothing"]:
            amount = 0
        else:
            # Extract numbers
            numbers = re.findall(r'\d+', message_text)
            if numbers:
                amount = float(numbers[0])
            else:
                # Ask again
                self.send_clarification_message(user.phone_number)
                return
        
        # Update ledger entry for cash
        entry = LedgerEntry(
            user_id=user.id,
            entry_type="cash_update",
            source_type="whatsapp_bot",
            cash_on_hand=amount,
            cash_update_date=date.today(),
            notes=f"WhatsApp update: {message_text}"
        )
        db.add(entry)
        db.commit()
        
        # Send confirmation
        self.send_confirmation_message(user, amount)
    
    async def schedule_daily_messages(self):
        """
        Run at 9 PM IST every day
        Send message to all active users
        """
        users = db.query(User).filter(User.is_active == True).all()
        for user in users:
            await self.send_daily_confirmation_message(user)

# routes/webhooks/whatsapp.py
from fastapi import APIRouter, Request

router = APIRouter()

@router.post("/webhooks/whatsapp")
async def handle_whatsapp_webhook(request: Request):
    """
    Receives inbound WhatsApp messages from Twilio
    Format:
    {
      "From": "whatsapp:+919876543210",
      "Body": "500"
    }
    """
    data = await request.form()
    phone = data.get("From").replace("whatsapp:+91", "")
    message = data.get("Body")
    
    await whatsapp_service.handle_inbound_message(phone, message)
    
    return {"status": "ok"}

# tasks/scheduled.py (APScheduler or Celery)
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

@scheduler.scheduled_job('cron', hour=21, minute=0, timezone='Asia/Kolkata')
def send_daily_whatsapp_messages():
    """Send at 9 PM IST daily"""
    service = WhatsAppBotService()
    asyncio.run(service.schedule_daily_messages())

scheduler.start()
```

```typescript
// Mobile: Handle inbound WhatsApp navigation

// If user comes from WhatsApp deep link:
// Example: https://moneyos.app/app?referrer=whatsapp&action=update_cash

export async function handleDeepLink(url: string) {
  const params = new URL(url).searchParams
  
  if (params.get("action") === "update_cash") {
    // Navigate to "add entry" with pre-filled cash
    router.push("/add-entry?entry_type=cash")
  }
}
```

**Timeline:** Week 2 (foundational for retention)

**Costs:**
- Twilio WhatsApp API: ₹1-2 per message
- APScheduler: Free (self-hosted)
- Infrastructure: <₹1K/month

---

### 3. Hidden Cost Detection Engine (Critical)

**Current state:**
- Transactions are categorized, but no analysis
- No insights about wasted money

**Must implement:**

```python
# backend/app/services/hidden_cost_analyzer.py

from datetime import date, timedelta
from enum import Enum

class HiddenCostType(str, Enum):
    DELIVERY_FEES = "delivery_fees"
    SUBSCRIPTION_DUPLICATE = "subscription_duplicate"
    CATEGORY_OVERSPEND = "category_overspend"
    UPI_FEES = "upi_fees"
    IMPULSE_SPIKE = "impulse_spike"

class HiddenCostInsight(BaseModel):
    type: HiddenCostType
    title: str  # "You're paying ₹400 in delivery fees"
    amount: float
    percentage_of_category: float
    action: str  # "Skip one quick commerce order per week"
    potential_savings: float
    frequency: str  # "weekly", "monthly"

class HiddenCostAnalyzer:
    def __init__(self, db: Session):
        self.db = db
    
    def analyze_user(self, user_id: str, days=30) -> list[HiddenCostInsight]:
        """
        Analyze last 30 days of transactions
        Return hidden costs user is bleeding
        """
        insights = []
        
        # Get transactions
        start_date = date.today() - timedelta(days=days)
        txns = self.db.query(NormalizedTransaction).filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.transaction_date >= start_date,
            NormalizedTransaction.direction == "debit"
        ).all()
        
        # 1. Delivery fees
        delivery_fees = self._detect_delivery_fees(txns)
        if delivery_fees["amount"] > 0:
            insights.append(HiddenCostInsight(
                type=HiddenCostType.DELIVERY_FEES,
                title=f"Delivery charges: ₹{delivery_fees['amount']:.0f}",
                amount=delivery_fees["amount"],
                percentage_of_category=delivery_fees["pct"],
                action="Plan groceries & food together (fewer deliveries)",
                potential_savings=delivery_fees["amount"] * 0.7,  # Save 70% by planning
                frequency="monthly"
            ))
        
        # 2. Subscription overlaps
        duplicates = self._detect_subscription_duplicates(txns)
        if duplicates:
            insights.extend(duplicates)
        
        # 3. Category overspending
        overspends = self._detect_category_overspend(txns, days)
        insights.extend(overspends)
        
        # 4. UPI micro-fees
        upi_fees = self._detect_upi_fees(txns)
        if upi_fees["amount"] > 0:
            insights.append(HiddenCostInsight(
                type=HiddenCostType.UPI_FEES,
                title=f"UPI fees/cashback: ₹{upi_fees['amount']:.0f}",
                amount=upi_fees["amount"],
                percentage_of_category=upi_fees["pct"],
                action="Use bank-owned UPI apps (reduce fees)",
                potential_savings=upi_fees["amount"] * 0.5,
                frequency="monthly"
            ))
        
        return insights
    
    def _detect_delivery_fees(self, txns: list):
        """Find delivery charges from quick commerce, food"""
        delivery_keywords = [
            "delivery",
            "zomato",
            "swiggy",
            "blinkit",
            "dunzo",
            "instamart",
            "zepto"
        ]
        
        delivery_txns = [
            t for t in txns
            if any(kw in t.description_clean for kw in delivery_keywords)
        ]
        
        # Estimate delivery fee as 10-15% of transaction
        total_amount = sum(t.amount for t in delivery_txns)
        estimated_fees = total_amount * 0.12  # 12% average
        
        if estimated_fees < 100:
            return {"amount": 0, "pct": 0}
        
        return {
            "amount": estimated_fees,
            "pct": (estimated_fees / total_amount * 100) if total_amount else 0,
            "transactions": len(delivery_txns)
        }
    
    def _detect_subscription_duplicates(self, txns: list):
        """Find subscription overlaps (Netflix + Disney, etc)"""
        insights = []
        
        # Group by subscription type
        subscriptions = {
            "streaming_video": [
                ("netflix", 199),
                ("hotstar", 499),
                ("prime video", 99),
                ("disney", 149),
            ],
            "music": [
                ("spotify", 120),
                ("gaana", 99),
                ("wynk", 99),
            ],
            "news": [
                ("inshorts", 0),  # Free
                ("medium", 999),
            ]
        }
        
        found = {cat: [] for cat in subscriptions}
        
        for category, subs in subscriptions.items():
            for sub_name, expected_price in subs:
                matching_txns = [
                    t for t in txns
                    if sub_name in t.description_clean
                    and t.category_code == "subscriptions"
                ]
                if matching_txns:
                    found[category].extend(matching_txns)
        
        # Check for overlaps
        if len(found["streaming_video"]) > 1:
            total = sum(t.amount for t in found["streaming_video"])
            insights.append(HiddenCostInsight(
                type=HiddenCostType.SUBSCRIPTION_DUPLICATE,
                title=f"Multiple streaming subscriptions: ₹{total:.0f}",
                amount=total,
                percentage_of_category=100,
                action="Keep 1, cancel 2+ (save ₹300-500/month)",
                potential_savings=total * 0.6,
                frequency="monthly"
            ))
        
        return insights
    
    def _detect_category_overspend(self, txns: list, days: int):
        """Month-over-month category comparison"""
        insights = []
        today = date.today()
        
        # Group by month and category
        current_month_txns = [
            t for t in txns
            if date(today.year, today.month, 1) <= t.transaction_date <= today
        ]
        
        previous_month_start = date(today.year, today.month - 1, 1)
        previous_month_end = date(today.year, today.month, 1) - timedelta(days=1)
        previous_month_txns = [
            t for t in txns
            if previous_month_start <= t.transaction_date <= previous_month_end
        ]
        
        # Compare by category
        from collections import defaultdict
        current_by_cat = defaultdict(float)
        previous_by_cat = defaultdict(float)
        
        for t in current_month_txns:
            current_by_cat[t.category_code] += t.amount
        
        for t in previous_month_txns:
            previous_by_cat[t.category_code] += t.amount
        
        # Find spikes
        for cat, current_amt in current_by_cat.items():
            prev_amt = previous_by_cat.get(cat, 0)
            
            if prev_amt > 0:
                increase_pct = ((current_amt - prev_amt) / prev_amt) * 100
                
                if increase_pct > 30:  # 30% increase
                    insights.append(HiddenCostInsight(
                        type=HiddenCostType.CATEGORY_OVERSPEND,
                        title=f"{cat.replace('_', ' ').title()} up {increase_pct:.0f}%",
                        amount=current_amt - prev_amt,
                        percentage_of_category=(increase_pct),
                        action=f"This month: ₹{current_amt:.0f}, last month: ₹{prev_amt:.0f}. Check why.",
                        potential_savings=(current_amt - prev_amt) * 0.5,
                        frequency="monthly"
                    ))
        
        return insights
    
    def _detect_upi_fees(self, txns: list):
        """Estimate hidden UPI transaction fees"""
        upi_txns = [t for t in txns if t.source_type == "upi"]
        total_transactions = len(upi_txns)
        total_amount = sum(t.amount for t in upi_txns)
        
        # Average UPI fee: 0.5-1% (but some banks waive, some charge)
        estimated_fee_rate = 0.007  # 0.7% average
        estimated_fees = total_amount * estimated_fee_rate
        
        if estimated_fees < 50:
            return {"amount": 0, "pct": 0}
        
        return {
            "amount": estimated_fees,
            "pct": (estimated_fees / total_amount * 100) if total_amount else 0,
            "transactions": total_transactions
        }

# routes/insights.py
@router.get("/insights/hidden-costs")
def get_hidden_costs(
    user_id: str = Query(...),
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db)
):
    """
    GET /insights/hidden-costs?user_id=XXX&days=30
    Returns list of hidden cost insights
    """
    analyzer = HiddenCostAnalyzer(db)
    insights = analyzer.analyze_user(user_id, days)
    
    return {
        "insights": insights,
        "total_potential_savings": sum(i.potential_savings for i in insights),
        "analyzed_days": days,
        "as_of": date.today()
    }
```

```typescript
// Mobile: Display hidden costs

// screens/insights/hidden-costs.tsx
export default function HiddenCostsScreen() {
  const [insights, setInsights] = useState<HiddenCostInsight[]>([])
  
  useEffect(() => {
    const fetchInsights = async () => {
      const response = await api.get("/insights/hidden-costs", {
        days: 30
      })
      setInsights(response.insights)
    }
    fetchInsights()
  }, [])
  
  const totalSavings = insights.reduce((sum, i) => sum + i.potential_savings, 0)
  
  return (
    <AppScreen title="Money You're Wasting">
      <SummaryCard
        amount={totalSavings}
        subtitle="Potential monthly savings"
      />
      
      <ScrollView>
        {insights.map((insight) => (
          <InsightCard
            key={insight.type}
            title={insight.title}
            amount={insight.amount}
            action={insight.action}
            potential={insight.potential_savings}
          />
        ))}
      </ScrollView>
    </AppScreen>
  )
}

// components/InsightCard.tsx
function InsightCard({ title, amount, action, potential }: Props) {
  return (
    <Card>
      <Text variant="title">{title}</Text>
      <Text variant="body">₹{amount.toLocaleString('en-IN')}</Text>
      <Text variant="caption">{action}</Text>
      <Text variant="success">
        💡 You could save ₹{potential.toLocaleString('en-IN')}/month
      </Text>
    </Card>
  )
}
```

**Timeline:** Week 2-3

---

## PART 3: PHASE 1 FEATURES (MVP Completeness)

### 4. Household Linking with Privacy Controls

**Data model:**

```python
# models/household.py

class Household(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "households"
    
    name: Mapped[str] = mapped_column(String(255))
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    
    # Members
    members = relationship("HouseholdMember", back_populates="household")
    
    # Settings
    show_individual_transactions: Mapped[bool] = default(True)
    show_partner_balance: Mapped[bool] = default(True)
    show_upcoming_dues: Mapped[bool] = default(True)
    
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    owner = relationship("User")

class HouseholdMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "household_members"
    
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    
    # Role
    role: Mapped[str] = mapped_column(String(50))  # "owner", "member"
    
    # Privacy
    can_view_partner_transactions: Mapped[bool] = default(True)
    can_manage_household_dues: Mapped[bool] = default(False)
    can_remove_members: Mapped[bool] = default(False)
    
    # Status
    status: Mapped[str] = mapped_column(String(50))  # "pending", "active", "removed"
    invitation_token: Mapped[Optional[str]]
    invitation_expires_at: Mapped[Optional[datetime]]
    
    household = relationship("Household", back_populates="members")
    user = relationship("User")

# routes/household.py

@router.post("/household/create")
def create_household(
    name: str,
    partner_phone: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Owner creates household and invites partner
    """
    household = Household(
        name=name,
        owner_user_id=current_user.id
    )
    db.add(household)
    db.flush()
    
    # Add owner as member
    owner_member = HouseholdMember(
        household_id=household.id,
        user_id=current_user.id,
        role="owner",
        status="active"
    )
    
    # Send invitation to partner
    token = secrets.token_urlsafe(32)
    partner_member = HouseholdMember(
        household_id=household.id,
        user_id=None,  # Will be linked on acceptance
        role="member",
        status="pending",
        invitation_token=token,
        invitation_expires_at=datetime.utcnow() + timedelta(days=7)
    )
    
    db.add_all([owner_member, partner_member])
    db.commit()
    
    # Send WhatsApp invitation
    whatsapp_service.send_household_invitation(
        partner_phone,
        household.name,
        token
    )
    
    return {"household_id": household.id, "status": "invitation_sent"}

@router.get("/household/summary")
def get_household_summary(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get combined household cashflow
    """
    household = get_household_for_user(current_user.id, household_id, db)
    
    # Combine cashflows from both users
    combined_summary = build_combined_cashflow_summary(household, db)
    
    return combined_summary
```

**Timeline:** Week 3-4

---

### 5. AI Bot (Rule-Based Spending Questions)

```python
# backend/app/services/spending_coach.py

class SpendingCoach:
    def __init__(self, db: Session):
        self.db = db
    
    async def answer_question(self, user_id: str, question: str) -> dict:
        """
        User asks natural language question
        Coach returns actionable answer
        """
        question_lower = question.lower()
        
        # Keyword-based routing (not ML, just rules)
        if any(w in question_lower for w in ["afford", "can i", "should i"]):
            return await self.answer_affordability(user_id, question)
        
        elif any(w in question_lower for w in ["spend most", "where", "category"]):
            return await self.answer_spending_breakdown(user_id, question)
        
        elif any(w in question_lower for w in ["save", "saving", "surplus"]):
            return await self.answer_savings_potential(user_id, question)
        
        elif any(w in question_lower for w in ["short", "shortfall", "money"]):
            return await self.answer_shortfall(user_id, question)
        
        elif any(w in question_lower for w in ["invest", "investment", "sip"]):
            return await self.answer_investment_readiness(user_id, question)
        
        else:
            return {
                "answer": "I didn't understand. Try asking about: spending, savings, affordability, or investments.",
                "type": "unclear"
            }
    
    async def answer_affordability(self, user_id: str, question: str) -> dict:
        """
        User: "Can I afford a ₹5000 laptop?"
        Coach: "Safe to spend is ₹1200. Laptop costs ₹5000. Wait 4 months."
        """
        summary = build_cashflow_summary(self.db, user_id)
        
        # Extract amount from question
        amount = extract_amount_from_question(question)
        
        if not amount:
            return {
                "answer": "I didn't catch the amount. Try: 'Can I afford ₹5000?'",
                "type": "clarify"
            }
        
        safe_to_spend = summary.safe_to_spend
        safe_to_save = summary.safe_to_save
        
        if amount <= safe_to_spend:
            return {
                "answer": f"Yes, easily! You have ₹{safe_to_spend:.0f} safe to spend. {amount:.0f} won't strain you.",
                "type": "yes",
                "amount": amount,
                "safe_to_spend": safe_to_spend
            }
        
        elif amount <= safe_to_spend + safe_to_save:
            months_to_wait = ceil(amount / summary.daily_needs_required)
            return {
                "answer": f"You could, but risky. Safe to spend is ₹{safe_to_spend:.0f}. Better to wait {months_to_wait} months to save ₹{amount:.0f}.",
                "type": "caution",
                "amount": amount,
                "months_to_wait": months_to_wait
            }
        
        else:
            months_needed = ceil(amount / summary.daily_needs_required)
            return {
                "answer": f"Not now. You'd need to save for {months_needed} months. Can you wait?",
                "type": "no",
                "amount": amount,
                "months_needed": months_needed
            }
    
    async def answer_spending_breakdown(self, user_id: str, question: str) -> dict:
        """
        User: "Where did I spend most last month?"
        Coach: Returns category breakdown
        """
        summary = build_cashflow_summary(self.db, user_id)
        
        breakdown = self._get_category_breakdown(user_id, days=30)
        
        top_3 = sorted(
            breakdown.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        answer = "Your top spending:\n"
        for category, amount in top_3:
            pct = (amount / sum(breakdown.values())) * 100
            answer += f"{category}: ₹{amount:.0f} ({pct:.0f}%)\n"
        
        return {
            "answer": answer,
            "type": "breakdown",
            "breakdown": dict(top_3)
        }
    
    def _get_category_breakdown(self, user_id: str, days: int) -> dict:
        """Group transactions by category"""
        from collections import defaultdict
        breakdown = defaultdict(float)
        
        start_date = date.today() - timedelta(days=days)
        txns = self.db.query(NormalizedTransaction).filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.transaction_date >= start_date,
            NormalizedTransaction.direction == "debit"
        ).all()
        
        for t in txns:
            breakdown[t.category_code] += t.amount
        
        return breakdown

# routes/coach.py
@router.post("/coach/ask")
async def ask_coach(
    question: str = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    POST /coach/ask
    { "question": "Can I afford ₹5000?" }
    """
    coach = SpendingCoach(db)
    answer = await coach.answer_question(current_user.id, question)
    
    # Log question for future ML training
    log_coach_interaction(current_user.id, question, answer, db)
    
    return answer
```

```typescript
// Mobile: Chat with coach

// screens/coach.tsx
export default function CoachScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  
  const handleSendQuestion = async () => {
    if (!input.trim()) return
    
    // Add user message
    setMessages(prev => [...prev, { role: "user", text: input }])
    setLoading(true)
    
    try {
      const response = await api.post("/coach/ask", {
        question: input
      })
      
      setMessages(prev => [...prev, {
        role: "coach",
        text: response.answer,
        type: response.type
      }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: "coach",
        text: "Sorry, I couldn't process that. Try rephrasing."
      }])
    }
    
    setInput("")
    setLoading(false)
  }
  
  return (
    <AppScreen title="MoneyOS Coach">
      <ScrollView style={{ flex: 1 }}>
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
      </ScrollView>
      
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Ask anything about your money..."
        multiline
      />
      <Button
        onPress={handleSendQuestion}
        disabled={loading}
      >
        {loading ? "Thinking..." : "Ask"}
      </Button>
    </AppScreen>
  )
}
```

**Timeline:** Week 2-3

---

### 6. Subscription Payment & AI Bot Tier

**Data model:**

```python
# models/subscription.py

class SubscriptionTier(str, Enum):
    FREE = "free"      # 5 questions/month
    BASIC = "basic"    # ₹99/month, 50 questions/month
    PRO = "pro"        # ₹299/month, unlimited + weekly coaching

class UserSubscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_subscriptions"
    
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    tier: Mapped[str] = mapped_column(String(50), default="free")
    
    # Billing
    monthly_amount: Mapped[float] = default(0)
    billing_cycle_start: Mapped[date]
    billing_cycle_end: Mapped[date]
    
    # Usage
    questions_asked_this_month: Mapped[int] = default(0)
    questions_limit: Mapped[int]  # 5 for free, 50 for basic, unlimited for pro
    
    # Payment
    payment_method_id: Mapped[Optional[str]]  # Razorpay token
    payment_status: Mapped[str] = mapped_column(String(50))  # "active", "failed", "canceled"
    
    # Auto-renew
    auto_renew: Mapped[bool] = default(True)
    next_billing_date: Mapped[Optional[date]]
    
    user = relationship("User")

class CoachQuestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "coach_questions"
    
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    answer_type: Mapped[str]
    was_helpful: Mapped[Optional[bool]]  # User feedback

# routes/subscriptions.py

@router.get("/subscription/status")
def get_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's subscription tier and usage"""
    sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.id
    ).first()
    
    if not sub:
        sub = UserSubscription(
            user_id=current_user.id,
            tier="free",
            questions_limit=5,
            billing_cycle_start=date.today(),
            billing_cycle_end=date.today() + timedelta(days=30)
        )
        db.add(sub)
        db.commit()
    
    return {
        "tier": sub.tier,
        "questions_remaining": sub.questions_limit - sub.questions_asked_this_month,
        "monthly_amount": sub.monthly_amount,
        "next_billing_date": sub.next_billing_date
    }

@router.post("/subscription/upgrade")
def upgrade_subscription(
    tier: str,  # "basic" or "pro"
    payment_method_id: str,  # Razorpay token
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upgrade to paid tier
    Integrates with Razorpay for recurring billing
    """
    amounts = {
        "basic": 99,
        "pro": 299
    }
    limits = {
        "basic": 50,
        "pro": float('inf')
    }
    
    # Create Razorpay subscription
    razorpay_sub_id = create_razorpay_subscription(
        customer_id=current_user.id,
        plan_id=f"plan_{tier}",
        amount=amounts[tier]
    )
    
    # Update subscription
    sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.id
    ).first()
    
    sub.tier = tier
    sub.monthly_amount = amounts[tier]
    sub.questions_limit = limits[tier]
    sub.payment_method_id = payment_method_id
    sub.payment_status = "active"
    sub.next_billing_date = date.today() + timedelta(days=30)
    
    db.commit()
    
    return {"status": "upgraded", "tier": tier}

# routes/coach.py - Check quota before answering
@router.post("/coach/ask")
async def ask_coach(
    question: str = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check quota before answering"""
    sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.id
    ).first()
    
    if sub.questions_asked_this_month >= sub.questions_limit:
        return {
            "error": "Question limit reached",
            "upgrade_url": "/subscription/upgrade"
        }
    
    # Answer question
    coach = SpendingCoach(db)
    answer = await coach.answer_question(current_user.id, question)
    
    # Increment counter
    sub.questions_asked_this_month += 1
    db.commit()
    
    return answer
```

```typescript
// Mobile: Payment flow

// screens/subscription.tsx
export default function SubscriptionScreen() {
  const [tier, setTier] = useState("free")
  const [loading, setLoading] = useState(false)
  
  const handleUpgrade = async (newTier: string) => {
    setLoading(true)
    
    // 1. Get Razorpay payment options
    const response = await api.post("/subscription/create-order", {
      tier: newTier
    })
    
    // 2. Open Razorpay modal
    const options = {
      key: RAZORPAY_KEY,
      amount: response.amount,
      currency: "INR",
      order_id: response.order_id,
      description: `MoneyOS ${newTier} Tier`,
      handler: async (paymentResponse) => {
        // 3. Verify payment and upgrade
        const result = await api.post("/subscription/upgrade", {
          tier: newTier,
          payment_id: paymentResponse.razorpay_payment_id
        })
        
        if (result.status === "upgraded") {
          Alert.alert("Success!", `Upgraded to ${newTier}`)
          setTier(newTier)
        }
      }
    }
    
    RazorpayCheckout.open(options)
    setLoading(false)
  }
  
  return (
    <AppScreen title="AI Coach Tier">
      <PricingCard
        tier="free"
        price="Free"
        questions={5}
        features={["5 questions/month", "Basic insights"]}
      />
      
      <PricingCard
        tier="basic"
        price="₹99"
        questions={50}
        features={["50 questions/month", "Hidden cost detection"]}
        onUpgrade={() => handleUpgrade("basic")}
        disabled={loading || tier !== "free"}
      />
      
      <PricingCard
        tier="pro"
        price="₹299"
        questions={null}
        features={["Unlimited questions", "Weekly coaching email"]}
        onUpgrade={() => handleUpgrade("pro")}
        disabled={loading}
      />
    </AppScreen>
  )
}
```

**Timeline:** Week 4

---

## PART 4: PHASE 2 FEATURES (Monetization & Integrations)

### 7. Referral Integrations (Insurance, Lending, Gig)

**Architecture: Partner SDK Integration**

```python
# backend/app/services/partner_integrations.py

class PartnerIntegrationService:
    """
    Base class for all partner integrations
    Each partner implements their own
    """
    
    def __init__(self, partner_key: str, partner_secret: str):
        self.partner_key = partner_key
        self.partner_secret = partner_secret
    
    async def send_lead(self, user_id: str, user_data: dict) -> dict:
        """
        Send user data to partner
        Return: { lead_id, status, commission_amount }
        """
        pass

class InsurancePartner(PartnerIntegrationService):
    """ICICI Prudential, Bajaj Allianz integration"""
    
    async def send_lead(self, user_id: str, user_data: dict):
        """
        Send user to insurance partner
        Expected user_data:
        {
            "name": "Rajesh",
            "age": 35,
            "phone": "+919876543210",
            "income": 50000,
            "monthly_savings": 1200,
            "dependents": 2
        }
        """
        payload = {
            "api_key": self.partner_key,
            "lead": {
                "name": user_data["name"],
                "phone": user_data["phone"],
                "age": user_data["age"],
                "annual_income": user_data["income"] * 12,
                "source": "moneyos",
                "source_ref": user_id
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://partner-api.icici.com/leads",
                json=payload
            ) as resp:
                result = await resp.json()
                
                # Log for commission tracking
                log_partner_lead(
                    user_id=user_id,
                    partner="icici",
                    lead_id=result["lead_id"],
                    commission=result.get("commission", 0)
                )
                
                return {
                    "lead_id": result["lead_id"],
                    "status": "sent",
                    "commission": result.get("commission", 0)
                }

class LendingPartner(PartnerIntegrationService):
    """NBFC integration (Ujjivan, Shriram)"""
    
    async def check_eligibility(self, user_id: str, user_data: dict) -> dict:
        """
        Check if user is eligible for loan
        Return: { eligible: bool, max_amount: float, rate: float }
        """
        payload = {
            "api_key": self.partner_key,
            "user": {
                "phone": user_data["phone"],
                "income": user_data["income"],
                "monthly_savings": user_data["monthly_savings"],
                "credit_history": user_data.get("credit_history", [])
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://partner-api.nbfc.com/eligibility",
                json=payload
            ) as resp:
                return await resp.json()
    
    async def initiate_loan(
        self,
        user_id: str,
        amount: float,
        tenure_days: int
    ) -> dict:
        """Initiate loan disbursement"""
        pass

class GigWorkPartner(PartnerIntegrationService):
    """Gig work platforms (Swiggy, TaskRabbit)"""
    
    async def send_referral(self, user_id: str, user_data: dict) -> dict:
        """
        Send user to gig platform
        They handle onboarding
        We get commission on signup
        """
        payload = {
            "api_key": self.partner_key,
            "referral": {
                "name": user_data["name"],
                "phone": user_data["phone"],
                "email": user_data.get("email"),
                "location": user_data.get("location"),
                "referrer_id": "moneyos",
                "referrer_user_id": user_id
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://partner-api.swiggy.com/referrals",
                json=payload
            ) as resp:
                result = await resp.json()
                
                return {
                    "referral_id": result["referral_id"],
                    "signup_link": result["signup_url"],
                    "commission": 100  # ₹100 per signup
                }

# routes/referrals.py

@router.post("/referrals/insurance")
async def send_insurance_lead(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    User clicks "Get insurance quote"
    Send their profile to insurance partner
    Get referral commission when they buy
    """
    # Get user cashflow data
    summary = build_cashflow_summary(db, current_user.id)
    profile = current_user.financial_profile
    
    user_data = {
        "name": current_user.display_name,
        "age": profile.age or 35,  # Default if not set
        "phone": current_user.phone_number,
        "income": profile.monthly_income or (summary.liquid_balance * 12),
        "monthly_savings": summary.safe_to_save,
        "dependents": profile.dependents or 1
    }
    
    insurance_partner = InsurancePartner(
        partner_key=ICICI_API_KEY,
        partner_secret=ICICI_SECRET
    )
    
    result = await insurance_partner.send_lead(current_user.id, user_data)
    
    # Store referral record
    referral = ReferralRecord(
        user_id=current_user.id,
        partner="icici_insurance",
        lead_id=result["lead_id"],
        commission_amount=result.get("commission", 0),
        status="pending",
        created_at=datetime.utcnow()
    )
    db.add(referral)
    db.commit()
    
    return {
        "status": "sent_to_partner",
        "next_steps": "Partner will contact you within 24 hours"
    }

@router.get("/referrals/status")
def get_referral_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all referrals and commissions earned"""
    referrals = db.query(ReferralRecord).filter(
        ReferralRecord.user_id == current_user.id
    ).all()
    
    total_commission = sum(r.commission_amount for r in referrals if r.status == "completed")
    
    return {
        "total_commission_earned": total_commission,
        "referrals": [
            {
                "partner": r.partner,
                "status": r.status,
                "commission": r.commission_amount,
                "date": r.created_at
            }
            for r in referrals
        ]
    }
```

```typescript
// Mobile: Referral UI

// screens/offers/insurance.tsx
export default function InsuranceOfferScreen() {
  const [loading, setLoading] = useState(false)
  
  const handleGetQuote = async () => {
    setLoading(true)
    try {
      const response = await api.post("/referrals/insurance")
      Alert.alert(
        "Sent to Partner",
        response.next_steps
      )
    } catch (error) {
      Alert.alert("Error", "Couldn't send your request")
    }
    setLoading(false)
  }
  
  return (
    <AppScreen title="Health Insurance">
      <Card>
        <Text variant="title">Health Insurance: ₹15L cover</Text>
        <Text>₹300/month (you can afford this!)</Text>
        <Text variant="caption">
          You saved ₹1.2K this month.
          Insurance = peace of mind.
        </Text>
        <Button
          onPress={handleGetQuote}
          disabled={loading}
        >
          {loading ? "Sending..." : "Get Free Quote"}
        </Button>
      </Card>
    </AppScreen>
  )
}
```

**Timeline:** Week 5-8

---

### 8. Government Scheme Database

```python
# models/government_scheme.py

class GovernmentScheme(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "government_schemes"
    
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(100), unique=True)  # "PMMY", "NRLM", etc.
    
    # Eligibility
    eligible_user_types: Mapped[list] = mapped_column(JSON)  # ["salaried", "daily_wage"]
    min_monthly_income: Mapped[float] = default(0)
    max_monthly_income: Mapped[Optional[float]]
    
    # Scheme details
    description: Mapped[str] = mapped_column(Text)
    max_loan_amount: Mapped[float]
    interest_rate: Mapped[float]  # 0% for some
    tenure_months: Mapped[int]
    
    # Localization
    description_hi: Mapped[Optional[str]] = mapped_column(Text)
    description_mr: Mapped[Optional[str]] = mapped_column(Text)
    
    # URLs
    official_url: Mapped[str]
    bank_url: Mapped[Optional[str]]
    
    # Status
    is_active: Mapped[bool] = default(True)
    last_updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

# routes/schemes.py

@router.get("/schemes/recommended")
def get_recommended_schemes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Show government schemes user is eligible for
    Based on: income, user_type, location, shortfall
    """
    profile = current_user.financial_profile
    summary = build_cashflow_summary(db, current_user.id)
    
    schemes = db.query(GovernmentScheme).filter(
        GovernmentScheme.is_active == True,
        GovernmentScheme.eligible_user_types.contains([profile.user_type]),
        GovernmentScheme.min_monthly_income <= (profile.monthly_income or 15000),
    ).all()
    
    # Filter by language
    language = current_user.language or "en"
    
    results = []
    for scheme in schemes:
        results.append({
            "code": scheme.code,
            "name": scheme.name,
            "description": getattr(scheme, f"description_{language}", scheme.description),
            "max_loan": scheme.max_loan_amount,
            "rate": scheme.interest_rate,
            "apply_url": scheme.official_url
        })
    
    return {
        "recommended_schemes": results,
        "total": len(results)
    }
```

**Timeline:** Week 6-8

---

## PART 5: TECHNICAL DEBT & INFRASTRUCTURE

### 9. Error Handling & Logging

```python
# backend/app/core/exceptions.py

class MoneyOSException(Exception):
    """Base exception"""
    pass

class AuthenticationError(MoneyOSException):
    status_code = 401

class AuthorizationError(MoneyOSException):
    status_code = 403

class ValidationError(MoneyOSException):
    status_code = 400

class PartnerIntegrationError(MoneyOSException):
    status_code = 502

# middleware
@app.exception_handler(MoneyOSException)
async def moneyos_exception_handler(request: Request, exc: MoneyOSException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": str(exc),
            "request_id": request.headers.get("x-request-id")
        }
    )

# Logging
import structlog

logger = structlog.get_logger()

@app.middleware("http")
async def log_request(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    
    logger.info(
        "request_start",
        path=request.url.path,
        method=request.method,
        request_id=request_id
    )
    
    response = await call_next(request)
    
    logger.info(
        "request_end",
        status_code=response.status_code,
        request_id=request_id
    )
    
    return response
```

**Timeline:** Week 3 (parallel with auth)

---

### 10. Analytics & Retention Tracking

```python
# models/analytics.py

class UserEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_events"
    
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(100))
    event_data: Mapped[dict] = mapped_column(JSON)
    session_id: Mapped[str]  # Track sessions
    
    # For cohort analysis
    cohort_date: Mapped[date]  # User's creation date
    days_since_signup: Mapped[int]  # Computed from event time

# Events to track
EVENTS = {
    "user_signup",
    "onboarding_completed",
    "home_screen_viewed",
    "cash_entry_added",
    "upcoming_due_created",
    "safe_to_spend_viewed",
    "coach_question_asked",
    "insurance_lead_sent",
    "lending_inquiry",
    "app_opened",
    "app_closed"
}

# Track in routes
@router.post("/ledger-entries")
def add_ledger_entry(
    entry: LedgerEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session_id: str = Header(...)
):
    # ... existing logic ...
    
    # Track event
    event = UserEvent(
        user_id=current_user.id,
        event_type="cash_entry_added",
        event_data={
            "amount": entry.amount,
            "type": entry.entry_type
        },
        session_id=session_id,
        cohort_date=current_user.created_at.date(),
        days_since_signup=(date.today() - current_user.created_at.date()).days
    )
    db.add(event)
    db.commit()
    
    return result

# Analytics queries
def get_retention_cohort(db: Session):
    """
    Cohort analysis: % of users returning
    Day 1, 7, 30, 90
    """
    query = """
    WITH cohorts AS (
        SELECT
            DATE_TRUNC('day', created_at) as cohort_date,
            COUNT(DISTINCT user_id) as cohort_size
        FROM users
        GROUP BY 1
    ),
    retention AS (
        SELECT
            u.created_at::date as cohort_date,
            (ue.created_at::date - u.created_at::date) as days_active,
            COUNT(DISTINCT ue.user_id) as users_active
        FROM user_events ue
        JOIN users u ON ue.user_id = u.id
        WHERE ue.event_type IN ('home_screen_viewed', 'cash_entry_added')
        GROUP BY 1, 2
    )
    SELECT
        c.cohort_date,
        c.cohort_size,
        SUM(CASE WHEN r.days_active = 0 THEN r.users_active ELSE 0 END) as day1,
        SUM(CASE WHEN r.days_active = 7 THEN r.users_active ELSE 0 END) as day7,
        SUM(CASE WHEN r.days_active = 30 THEN r.users_active ELSE 0 END) as day30
    FROM cohorts c
    LEFT JOIN retention r ON c.cohort_date = r.cohort_date
    GROUP BY 1, 2
    """
    return db.execute(text(query)).fetchall()
```

**Timeline:** Week 4 (parallel)

---

## PART 6: DATABASE SCHEMA ADDITIONS

```python
# New tables needed:

# Auth
- otp_sessions
- user_sessions

# Features
- households
- household_members
- user_subscriptions
- coach_questions
- government_schemes

# Analytics
- user_events
- referral_records
- partner_leads

# Migrations
alembic revision --autogenerate -m "Add auth, household, subscription tables"
```

---

## PART 7: DEPLOYMENT & INFRASTRUCTURE

**Current:**
- Backend: Render (Python)
- Mobile: Expo (EAS builds)
- Database: PostgreSQL on Render

**Add:**

```yaml
# docker-compose.yml (for local dev + staging)
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: life_ledger
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  api:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:dev_password@postgres:5432/life_ledger
      REDIS_URL: redis://redis:6379

# Render deployment
# Create GitHub Actions for:
# - Run tests on PR
# - Deploy to Render on merge to main
# - Build mobile APK on release

# Monitoring
# - Error tracking: Sentry
# - Analytics: Mixpanel or Amplitude
# - Logs: CloudWatch or DataDog
```

**Timeline:** Week 1 (foundational)

---

## PART 8: MOBILE IMPROVEMENTS

```typescript
// Better error handling
interface ApiError {
  code: string
  message: string
  retryable: boolean
}

const api = {
  async request(method, url, data?) {
    try {
      const response = await fetch(url, {...})
      
      if (!response.ok) {
        const errorData = await response.json()
        throw {
          code: errorData.error,
          message: errorData.message,
          retryable: response.status >= 500
        }
      }
      
      return response.json()
    } catch (error) {
      if (error.retryable) {
        // Show retry UI
      } else if (error.code === "auth_required") {
        // Navigate to login
      }
      throw error
    }
  }
}

// Offline support
import AsyncStorage from '@react-native-async-storage/async-storage'

const offlineQueue = {
  async enqueue(action) {
    const queue = await AsyncStorage.getItem('offline_queue') || '[]'
    queue.push(action)
    await AsyncStorage.setItem('offline_queue', JSON.stringify(queue))
  },
  
  async dequeue() {
    const queue = JSON.parse(await AsyncStorage.getItem('offline_queue') || '[]')
    // Retry actions when online
  }
}

// Network status detection
import NetInfo from '@react-native-community/netinfo'

useEffect(() => {
  NetInfo.fetch().then(state => {
    setIsOnline(state.isConnected)
  })
}, [])

// Only sync when online
useEffect(() => {
  if (isOnline) {
    offlineQueue.dequeue()
  }
}, [isOnline])
```

**Timeline:** Week 3-4

---

## IMPLEMENTATION ROADMAP (Summary)

| Week | Feature | Status | Owner |
|------|---------|--------|-------|
| 1 | Real OTP Auth | Critical | Backend |
| 1 | Infrastructure setup | Critical | DevOps |
| 2 | WhatsApp Bot | Critical | Backend |
| 2 | Hidden Cost Engine | Core | Backend |
| 2 | Error Handling | Foundation | Full stack |
| 3 | Household Manager | Feature | Backend + Mobile |
| 3 | Coach (Rule-based) | Feature | Backend + Mobile |
| 3 | Analytics setup | Foundation | Backend |
| 4 | Subscription Payment | Monetization | Backend + Mobile |
| 5-8 | Partner Integrations | Monetization | Backend |
| 6-8 | Govt Schemes | Feature | Backend |
| Ongoing | Offline Support | UX | Mobile |
| Ongoing | Testing | QA | Full stack |

---

## Key Technical Decisions Made

1. **No real ML yet** - Start with rules-based, migrate to ML after 6+ months of data
2. **WhatsApp primary, SMS fallback** - Cheaper, better UX
3. **Partner model, not owned products** - Insurance, lending, gig integrated, not built
4. **Cohort analysis first** - Measure retention before scaling
5. **PostgreSQL + Redis** - Scale better than SQLite
6. **Expo for mobile** - Faster iteration, simpler builds
7. **Rule-based categorization** - Transparent, debuggable

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| WhatsApp API throttling at scale | Fallback to SMS, batching logic |
| OTP delivery delays (Twilio) | Resend mechanism, SMS fallback |
| Partner integration delays | Build stubs, manual testing |
| User confusion with household mode | Clear UX, privacy education |
| Retention drops after day 7 | Build WhatsApp reminders, habits |

---

**Document version:** 1.0
**Next review:** 2026-05-15 (after first 2 weeks of implementation)
