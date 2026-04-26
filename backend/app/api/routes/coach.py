from fastapi import APIRouter

from app.llm.service import reply_with_stub_coach_message
from app.schemas.insights import CoachMessageRequest, CoachMessageResponse

router = APIRouter(prefix="/coach", tags=["coach"])


@router.post("/messages", response_model=CoachMessageResponse)
def post_coach_message(payload: CoachMessageRequest) -> CoachMessageResponse:
    return reply_with_stub_coach_message(payload.message)
