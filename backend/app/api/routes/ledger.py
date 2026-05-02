from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.emi_payment import EMIPayment
from app.models.ledger_entry import LedgerEntry
from app.models.user import User
from app.schemas.ledger import LedgerEntryCreate, LedgerEntryRead
from app.services.upcoming_dues import create_next_recurring_due

router = APIRouter(prefix="/ledger-entries", tags=["ledger entries"])


@router.get("", response_model=list[LedgerEntryRead])
def list_ledger_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(LedgerEntry)
        .filter(LedgerEntry.user_id == current_user.id)
        .order_by(LedgerEntry.entry_date.desc(), LedgerEntry.created_at.desc())
        .all()
    )


@router.post("", response_model=LedgerEntryRead)
def create_ledger_entry(
    payload: LedgerEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emi_payment = None
    if payload.emi_payment_id:
        emi_payment = (
            db.query(EMIPayment)
            .filter(EMIPayment.id == payload.emi_payment_id, EMIPayment.user_id == current_user.id)
            .first()
        )
        if emi_payment is None:
            raise HTTPException(status_code=404, detail="Due item not found")

    entry = LedgerEntry(
        user_id=current_user.id,
        entry_type=payload.entry_type.value,
        amount=payload.amount,
        entry_date=payload.entry_date,
        account_type=payload.account_type.value,
        counterparty_name=payload.counterparty_name,
        category_code=payload.category_code,
        subcategory_code=payload.subcategory_code,
        description=payload.description,
        source_label=payload.source_label,
        cash_direction=payload.cash_direction.value if payload.cash_direction else None,
        loan_id=payload.loan_id,
        emi_payment_id=payload.emi_payment_id,
        is_business=payload.is_business,
    )
    db.add(entry)
    if emi_payment and payload.entry_type.value == "emi_payment":
        updated_paid = float(emi_payment.amount_paid) + float(payload.amount)
        emi_payment.amount_paid = updated_paid
        emi_payment.paid_date = payload.entry_date
        emi_payment.status = "paid" if updated_paid >= float(emi_payment.amount_due) else "partial"
        db.add(emi_payment)
        if emi_payment.status == "paid" and emi_payment.loan is not None:
            create_next_recurring_due(db, loan=emi_payment.loan, current_payment=emi_payment)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=LedgerEntryRead)
def get_ledger_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.id == entry_id, LedgerEntry.user_id == current_user.id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    return entry
