from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.ingestion.pipeline import process_import_file
from app.ingestion.service import detect_import_file_type
from app.models.user import User
from app.schemas.imports import FileUploadResponse

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/files", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    force_reprocess: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileUploadResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_type = detect_import_file_type(file.filename or "", content)
    if file_type is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use .csv, .xlsx, or .xls.",
        )

    try:
        return process_import_file(
            db,
            user_id=current_user.id,
            file_name=file.filename or "upload",
            file_type=file_type,
            content=content,
            force_reprocess=force_reprocess,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
