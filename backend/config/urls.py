from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from projects.views import (
    DashboardView,
    HealthView,
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
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path(
        "api/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/reports/projects.pdf", ProjectPdfView.as_view(), name="project_pdf"),
    path("api/", include(router.urls)),
]
