from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _

from projects.models import Project, ProjectSnapshot, UserProfile

User = get_user_model()


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0
    fields = ("role", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")


admin.site.unregister(User)


@admin.register(User)
class ProjectHubUserAdmin(UserAdmin):
    inlines = (*UserAdmin.inlines, UserProfileInline)
    list_display = (*UserAdmin.list_display, "project_hub_role")

    @admin.display(description=_("Project Hub role"))
    def project_hub_role(self, obj):
        try:
            return obj.profile.role
        except UserProfile.DoesNotExist:
            return UserProfile.Role.ADMIN if obj.is_staff else UserProfile.Role.USER


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


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")
