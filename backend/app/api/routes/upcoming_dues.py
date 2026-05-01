from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.emi_payment import EMIPayment
from app.models.loan import Loan
from app.models.user import User
from app.schemas.upcoming_due import UpcomingDueCreate, UpcomingDueRead

router = APIRouter(prefix="/upcoming-dues", tags=["upcoming dues"])


@router.post("", response_model=UpcomingDueRead)
def create_upcoming_due(
    payload: UpcomingDueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    loan = Loan(
        user_id=current_user.id,
        loan_type="informal_due",
        counterparty_name=payload.name.strip(),
        principal_amount=payload.amount,
        interest_type="none",
        start_date=today,
        due_date=payload.due_date,
        emi_amount=payload.amount if payload.repeat_monthly else None,
        emi_frequency="monthly" if payload.repeat_monthly else None,
        outstanding_principal=payload.amount,
        notes=payload.notes,
        is_business=False,
    )
    db.add(loan)
    db.flush()

    emi_payment = EMIPayment(
        user_id=current_user.id,
        loan_id=loan.id,
        due_date=payload.due_date,
        amount_due=payload.amount,
        amount_paid=0,
        status="pending",
        source_type="manual_due",
    )
    db.add(emi_payment)
    db.commit()
    db.refresh(loan)
    db.refresh(emi_payment)

    return UpcomingDueRead(
        loan_id=loan.id,
        emi_payment_id=emi_payment.id,
        name=loan.counterparty_name,
        amount=float(emi_payment.amount_due),
        due_date=emi_payment.due_date,
        repeat_monthly=payload.repeat_monthly,
        notes=loan.notes,
        created_at=emi_payment.created_at,
    )
