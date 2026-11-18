from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from projects.views import (
    AdminDashboardView,
    AdminDatabaseView,
    AdminUserListView,
    AdminUserRoleView,
    CurrentUserView,
    DashboardView,
    HealthView,
    LoginView,
    ProjectPdfView,
    ProjectViewSet,
    RegisterView,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/auth/me/", CurrentUserView.as_view(), name="current_user"),
    path(
        "api/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/admin/dashboard/", AdminDashboardView.as_view(), name="admin_dashboard"),
    path("api/admin/database/", AdminDatabaseView.as_view(), name="admin_database"),
    path("api/admin/users/", AdminUserListView.as_view(), name="admin_users"),
    path(
        "api/admin/users/<int:user_id>/role/",
        AdminUserRoleView.as_view(),
        name="admin_user_role",
    ),
    path("api/reports/projects.pdf", ProjectPdfView.as_view(), name="project_pdf"),
    path("api/", include(router.urls)),
]
