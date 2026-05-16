# MoneyOS CSV Ingestion Spec

## Goal

Turn bank, card, and wallet statement files into a normalized transaction stream that can support:

- safe-to-spend calculations
- due detection
- recurring payment detection
- statement-backed watchouts

The current product does not depend on perfect imports yet, but import quality is the main path to trust over time.

## Current Supported Inputs

- `.csv`
- `.xlsx`
- `.xls` when optional dependencies are installed

## Current Product Role Of Imports

Imports are used to:

- seed recent money history
- detect inflows and outflows
- classify likely salary, rent, EMI, subscription, bill, transfer, and essential spend patterns
- support recurring due and watchout generation

Imports are **not yet** the strongest polished user path. The sample statement flow is currently stronger for demos.

## Ingestion Principles

- deterministic parsing first
- row-by-row tolerance where possible
- raw imported data stays traceable
- normalized data powers product logic
- no LLM required for core parsing

## Canonical Transaction Shape

Every successfully normalized row should produce:

- `user_id`
- `source_name`
- `source_type`
- `transaction_date`
- `posted_date`
- `amount`
- `currency`
- `direction`
- `description_raw`
- `description_clean`
- `counterparty`
- `category`
- `is_recurring`
- `is_fixed_obligation`
- `confidence_score`
- `raw_import_id`

## Source Types

Current broad source types:

- `bank`
- `card`
- `wallet`
- `other`

## Important Product Behaviors

Imports should help us detect:

- salary or regular income
- rent
- EMI / loan repayments
- subscriptions
- utility / recharge bills
- essential day-to-day spending
- transfers that should not count as real spend

## Deduplication

Current dedupe uses a fingerprint built from:

- user
- date
- amount
- direction
- cleaned description
- source

This is good enough for obvious repeated imports, but not yet a full institution-grade reconciliation layer.

## Current Limitations

- limited bank/card template coverage
- no human review loop yet
- no async import processing pipeline yet
- no strong imported-due management UI yet

## What Good Import Quality Unlocks

- more believable bank money seen this cycle
- more specific named dues
- recurring payment surfacing
- forgotten subscription moments
- lower manual entry burden
