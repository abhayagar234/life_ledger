from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.loan import Loan
from app.models.user import User
from app.schemas.loan import LoanCreate, LoanRead, LoanUpdate

router = APIRouter(prefix="/loans", tags=["loans"])


@router.get("", response_model=list[LoanRead])
def list_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Loan).filter(Loan.user_id == current_user.id).order_by(Loan.start_date.desc()).all()


@router.post("", response_model=LoanRead)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = Loan(
        user_id=current_user.id,
        loan_type=payload.loan_type.value,
        counterparty_name=payload.counterparty_name,
        principal_amount=payload.principal_amount,
        interest_type=payload.interest_type.value,
        interest_rate=payload.interest_rate,
        flat_interest_amount=payload.flat_interest_amount,
        start_date=payload.start_date,
        due_date=payload.due_date,
        emi_amount=payload.emi_amount,
        emi_frequency=payload.emi_frequency.value if payload.emi_frequency else None,
        outstanding_principal=payload.principal_amount,
        notes=payload.notes,
        is_business=payload.is_business,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan


@router.patch("/{loan_id}", response_model=LoanRead)
def update_loan(
    loan_id: str,
    payload: LoanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(loan, key, value.value if hasattr(value, "value") else value)

    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan
