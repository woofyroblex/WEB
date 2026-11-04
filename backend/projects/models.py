from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        USER = "user", "User"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.USER)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.username} ({self.role})"


class Project(models.Model):
    class Status(models.TextChoices):
        BACKLOG = "backlog", "Backlog"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=1200)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.BACKLOG,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-id")

    def __str__(self) -> str:
        return self.title


class ProjectSnapshot(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_snapshots",
    )
    day = models.DateField()
    backlog_count = models.PositiveIntegerField(default=0)
    in_progress_count = models.PositiveIntegerField(default=0)
    completed_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("day",)
        constraints = [
            models.UniqueConstraint(
                fields=("owner", "day"),
                name="one_project_snapshot_per_owner_day",
            )
        ]

    def __str__(self) -> str:
        return f"{self.owner_id} project snapshot on {self.day}"
