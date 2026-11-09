from datetime import date

from celery import shared_task
from django.db import OperationalError
from django.db.models import Count
from django.utils import timezone

from projects.models import Project, ProjectSnapshot


def _record_snapshot(owner_id: int, day: date) -> ProjectSnapshot:
    counts = {
        row["status"]: row["total"]
        for row in Project.objects.filter(owner_id=owner_id)
        .values("status")
        .annotate(total=Count("id"))
    }
    snapshot, _created = ProjectSnapshot.objects.update_or_create(
        owner_id=owner_id,
        day=day,
        defaults={
            "backlog_count": counts.get(Project.Status.BACKLOG, 0),
            "in_progress_count": counts.get(Project.Status.IN_PROGRESS, 0),
            "completed_count": counts.get(Project.Status.COMPLETED, 0),
        },
    )
    return snapshot


@shared_task(
    autoretry_for=(OperationalError,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    time_limit=60,
)
def record_project_snapshot(owner_id: int) -> int:
    return _record_snapshot(owner_id, timezone.localdate()).pk


@shared_task(time_limit=300, soft_time_limit=270)
def record_all_project_snapshots() -> int:
    day = timezone.localdate()
    project_counts = Project.objects.values("owner_id", "status").annotate(
        total=Count("id")
    )
    counts_by_owner: dict[int, dict[str, int]] = {}
    for row in project_counts:
        counts_by_owner.setdefault(row["owner_id"], {})[row["status"]] = row["total"]

    snapshots = [
        ProjectSnapshot(
            owner_id=owner_id,
            day=day,
            backlog_count=counts.get(Project.Status.BACKLOG, 0),
            in_progress_count=counts.get(Project.Status.IN_PROGRESS, 0),
            completed_count=counts.get(Project.Status.COMPLETED, 0),
        )
        for owner_id, counts in counts_by_owner.items()
    ]
    ProjectSnapshot.objects.bulk_create(
        snapshots,
        update_conflicts=True,
        unique_fields=("owner", "day"),
        update_fields=(
            "backlog_count",
            "in_progress_count",
            "completed_count",
            "created_at",
        ),
    )
    return len(snapshots)
