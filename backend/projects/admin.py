from django.contrib import admin

from projects.models import Project, ProjectSnapshot


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "status", "updated_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "description", "owner__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProjectSnapshot)
class ProjectSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "owner",
        "day",
        "backlog_count",
        "in_progress_count",
        "completed_count",
    )
    list_filter = ("day",)
    readonly_fields = ("created_at",)
