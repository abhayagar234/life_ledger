from datetime import date

from app.schemas.insights import CoachMessageResponse, InsightCard


def build_stub_insights() -> list[InsightCard]:
    today = date.today()
    return [
        InsightCard(
            title="Cash tracking started",
            message="Add a few more entries to unlock stronger spending insights.",
            period_start=today,
            period_end=today,
        )
    ]


def reply_with_stub_coach_message(message: str) -> CoachMessageResponse:
    return CoachMessageResponse(
        reply=f"You said: {message}. Coaching is scaffolded for now. Start with cash, dues, and this month's spending.",
    )
