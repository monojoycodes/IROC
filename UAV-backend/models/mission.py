# ═══════════════════════════════════════════════════════════
# Pydantic Models — API response schemas
# ═══════════════════════════════════════════════════════════

from pydantic import BaseModel


class MissionStateResponse(BaseModel):
    state: str
    progress: float
    message: str


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    last_mission_timestamp: str | None = None
    log_size_mb: float | None = None
    parse_duration_seconds: float | None = None


class MissionListItem(BaseModel):
    id: str
    label: str
    timestamp: str


class DownloadMeta(BaseModel):
    raw_log_mb: float | None = None
    json_mb: float | None = None
