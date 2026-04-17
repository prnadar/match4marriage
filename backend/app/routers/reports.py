"""
Reports + Admin router.
POST /api/v1/reports                    — file a report
GET  /api/v1/admin/reports              — admin: list reports
PUT  /api/v1/admin/reports/{id}         — admin: resolve report
GET  /api/v1/admin/trust-score/{user_id} — recalculate trust score
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, require_admin
from app.core.tenancy import get_current_tenant_slug
from app.models.report import Report, ReportCategory, ReportStatus
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(tags=["reports"])
logger = get_logger(__name__)


class ReportCreate:
    pass


from pydantic import BaseModel


class ReportCreateRequest(BaseModel):
    reported_user_id: uuid.UUID
    category: ReportCategory
    description: str | None = None
    evidence: list[str] = []  # S3 keys or message IDs


class ReportResolveRequest(BaseModel):
    status: ReportStatus
    admin_notes: str | None = None
    action_taken: str | None = None


@router.post("/reports", response_model=APIResponse[dict])
async def file_report(
    payload: ReportCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    from app.routers.profile import _resolve_tenant_uuid
    reporter_id = uuid.UUID(current_user["sub"])
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    report = Report(
        tenant_id=tenant_uuid,
        reporter_id=reporter_id,
        reported_user_id=payload.reported_user_id,
        category=payload.category,
        description=payload.description,
        evidence=payload.evidence,
    )
    db.add(report)
    await db.flush()

    # Check if reported user has 3+ open reports → auto-suspend
    count_result = await db.execute(
        select(func.count()).where(
            Report.reported_user_id == payload.reported_user_id,
            Report.status == ReportStatus.OPEN,
            Report.deleted_at.is_(None),
        )
    )
    open_count = count_result.scalar()
    if open_count >= 3:
        logger.warning(
            "auto_suspend_threshold_reached",
            reported_user=str(payload.reported_user_id),
            report_count=open_count,
        )
        # TODO Sprint 2: set user.is_active = False, send notification

    logger.info("report_filed", reporter=str(reporter_id), reported=str(payload.reported_user_id))
    return APIResponse(success=True, data={"report_id": str(report.id)})


# /admin/reports endpoints moved to app/routers/admin.py (tenant-isolated + enriched).
