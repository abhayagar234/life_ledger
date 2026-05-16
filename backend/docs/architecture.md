# Life Ledger Architecture

## Current Phase

Current phase: early-access demo build for MoneyOS.

The product is centered on survival clarity:

- `Will my money last till the next income?`
- `What dues should I protect first?`
- `How much is safe to spend right now?`

## Product Shape

The current architecture supports a lightweight, explainable client-server app:

1. mobile app for onboarding, home summary, and lightweight corrections
2. FastAPI backend for profile, imports, cashflow logic, and due handling
3. SQL database for user, profile, imports, normalized transactions, dues, and manual ledger events

This is a modular monolith, not a distributed system.

## What The System Does Today

### Mobile App

Primary responsibilities:

- persona-aware onboarding
- auto-load sample statement history after setup
- show cashflow home screen with:
  - hero status
  - safe-to-spend / still-to-protect
  - gauge
  - freshness messaging
  - watchouts
  - explanations
- accept lightweight manual corrections:
  - cash in hand
  - big spend
  - cash received
  - due paid
- add upcoming due

### Backend API

Primary responsibilities:

- auth-light session bootstrap
- onboarding profile read/write
- sample statement seeding
- CSV import foundation
- transaction normalization and deduplication
- rule-based categorization
- recurring-pattern and due inference support
- cashflow summary generation
- ledger event capture
- upcoming due creation

### Database

The database stores:

- user and profile data
- manual ledger events
- import file metadata
- raw imported rows
- normalized transactions
- loan / EMI style due records
- generated summary inputs

## Architectural Principles

- deterministic numbers first
- explanations should be traceable
- imports should do the heavy lifting
- manual input should stay lightweight
- no black-box AI in the money math
- no required live financial integrations in the demo build

## Current Deployment Shape

### Mobile

- Expo + React Native + TypeScript

### Backend

- FastAPI
- SQLAlchemy
- SQLite in local development
- PostgreSQL-ready for hosted deployment

## What Is Not In The Current Architecture

These are not part of the real current build:

- live bank sync
- UPI integrations
- Account Aggregator integration
- OCR-heavy ingestion
- Redis job queues
- production auth flows
- real AI coach orchestration
- microservices

## Why The Current Shape Is Intentionally Simple

The product still needs to prove:

- users understand the answer quickly
- users trust dues protection
- users use lightweight corrections
- statement history plus manual updates feels believable

A simple architecture is the right match for that stage.
