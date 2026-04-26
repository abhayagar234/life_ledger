from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.ledger_entry import LedgerEntry
from app.models.user import User
from app.schemas.ledger import LedgerEntryCreate, LedgerEntryRead

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
