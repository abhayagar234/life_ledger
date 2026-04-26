from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.emi_payment import EMIPayment
from app.models.loan import Loan
from app.models.user import User
from app.schemas.emi_payment import EMIPaymentCreate, EMIPaymentRead, EMIPaymentUpdate

router = APIRouter(prefix="/emi-payments", tags=["emi payments"])


@router.get("", response_model=list[EMIPaymentRead])
def list_emi_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(EMIPayment)
        .filter(EMIPayment.user_id == current_user.id)
        .order_by(EMIPayment.due_date.asc(), EMIPayment.created_at.desc())
        .all()
    )


@router.post("", response_model=EMIPaymentRead)
def create_emi_payment(
    payload: EMIPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = db.query(Loan).filter(Loan.id == payload.loan_id, Loan.user_id == current_user.id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")

    emi_payment = EMIPayment(
        user_id=current_user.id,
        loan_id=payload.loan_id,
        due_date=payload.due_date,
        amount_due=payload.amount_due,
        principal_component=payload.principal_component,
        interest_component=payload.interest_component,
        amount_paid=payload.amount_paid,
        paid_date=payload.paid_date,
        status=payload.status.value,
        source_type=payload.source_type,
    )
    db.add(emi_payment)
    db.commit()
    db.refresh(emi_payment)
    return emi_payment


@router.patch("/{emi_payment_id}", response_model=EMIPaymentRead)
def update_emi_payment(
    emi_payment_id: str,
    payload: EMIPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emi_payment = (
        db.query(EMIPayment)
        .filter(EMIPayment.id == emi_payment_id, EMIPayment.user_id == current_user.id)
        .first()
    )
    if emi_payment is None:
        raise HTTPException(status_code=404, detail="EMI payment not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(emi_payment, key, value.value if hasattr(value, "value") else value)

    db.add(emi_payment)
    db.commit()
    db.refresh(emi_payment)
    return emi_payment
