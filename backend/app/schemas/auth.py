from pydantic import BaseModel


class DemoLoginRequest(BaseModel):
    display_name: str = "Demo User"
    phone_number: str | None = None
    force_new: bool = False


class DemoLoginResponse(BaseModel):
    user_id: str
    display_name: str
    message: str
