import sys
sys.path.insert(0, '/Users/Abhay/life-ledger/backend')

from io import BytesIO
from app.ingestion.pdf_reader import read_pdf_rows
from app.categorization.engine import categorize_transaction
from app.categorization.types import CategorizationInput
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import create_engine

# Read PDF
pdf_path = '/Users/Abhay/Downloads/8939235315131032026_unlocked.pdf'
with open(pdf_path, 'rb') as f:
    pdf_content = f.read()

sheet = read_pdf_rows(pdf_content)
print(f"Parsed {len(sheet.rows)} transactions from PDF")
print(f"Headers: {sheet.headers}\n")

# Create a dummy session for categorization (if needed)
engine = create_engine("sqlite:///:memory:")
session = Session(engine)

categorizations = {}
health_transactions = []

for idx, row in enumerate(sheet.rows):
    # Map row to transaction fields based on headers
    row_dict = {header: row[i] if i < len(row) else None for i, header in enumerate(sheet.headers)}
    
    # Extract relevant fields
    date_str = row_dict.get('transaction date') or row_dict.get('date')
    description = row_dict.get('description') or row_dict.get('particulars') or ''
    debit = row_dict.get('debit') or row_dict.get('amount') or ''
    credit = row_dict.get('credit') or ''
    counterparty = row_dict.get('counterparty') or ''
    
    # Parse amount and direction
    try:
        if credit and str(credit).replace(',', '').replace('.', '').isdigit():
            amount = float(str(credit).replace(',', ''))
            direction = 'credit'
        elif debit and str(debit).replace(',', '').replace('.', '').isdigit():
            amount = float(str(debit).replace(',', ''))
            direction = 'debit'
        else:
            continue
    except:
        continue
    
    if not description or amount == 0:
        continue
    
    # Clean description
    description_clean = str(description).strip() if description else ''
    
    try:
        txn_date = datetime.strptime(str(date_str), '%d-%m-%y') if date_str else datetime.now()
    except:
        txn_date = datetime.now()
    
    # Create categorization input
    payload = CategorizationInput(
        user_id=1,
        amount=amount,
        direction=direction,
        description_clean=description_clean,
        counterparty=counterparty or description_clean
    )
    
    # Categorize
    result = categorize_transaction(session, payload=payload, transaction_date=txn_date)
    
    categorizations[idx] = {
        'date': date_str,
        'description': description_clean,
        'amount': amount,
        'direction': direction,
        'category': result.category,
        'confidence': result.confidence_score,
        'is_recurring': result.is_recurring,
        'rule_trace': result.rule_trace
    }
    
    # Track health transactions
    if result.category == 'health':
        health_transactions.append({
            'date': date_str,
            'description': description_clean,
            'amount': amount,
            'direction': direction,
            'confidence': result.confidence_score,
            'rule_trace': result.rule_trace
        })

# Print summary
print("=" * 80)
print("CATEGORIZATION SUMMARY")
print("=" * 80)

category_totals = {}
for txn in categorizations.values():
    cat = txn['category']
    if cat not in category_totals:
        category_totals[cat] = {'count': 0, 'amount': 0}
    if txn['direction'] == 'debit':
        category_totals[cat]['amount'] += txn['amount']
    category_totals[cat]['count'] += 1

print("\nCategory Breakdown:")
for cat in sorted(category_totals.keys()):
    total = category_totals[cat]
    print(f"  {cat:25s}: ₹{total['amount']:10,.2f} ({total['count']:3d} txns)")

print("\n" + "=" * 80)
print("HEALTH/HOSPITAL TRANSACTIONS")
print("=" * 80)
if health_transactions:
    total_health = sum(t['amount'] for t in health_transactions)
    print(f"\nFound {len(health_transactions)} health-related transaction(s)")
    print(f"Total spent on health: ₹{total_health:,.2f}\n")
    for txn in health_transactions:
        print(f"  {txn['date']}: {txn['description'][:40]:40s} ₹{txn['amount']:10,.2f}")
        print(f"            Confidence: {txn['confidence']:.2f} | Trace: {', '.join(txn['rule_trace'])}")
else:
    print("\nNo health/hospital transactions found")

print("\n" + "=" * 80)
print("DETAILED TRANSACTION LOG")
print("=" * 80)
for idx, txn in list(categorizations.items())[:30]:  # First 30 txns
    print(f"{txn['date']}: {txn['description'][:40]:40s} ₹{txn['amount']:8,.2f} -> {txn['category']:20s} ({txn['confidence']:.2f})")

