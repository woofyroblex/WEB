from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project, ProjectSnapshot, UserProfile
from projects.serializers import (
    AdminUserSerializer,
    CurrentUserSerializer,
    ProjectSerializer,
    ProjectSnapshotSerializer,
    RegisterSerializer,
    UserRoleUpdateSerializer,
)
from projects.tasks import record_project_snapshot

User = get_user_model()


class HealthView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes: tuple = ()

    def get(self, request):
        return Response({"status": "ok"})


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)
    authentication_classes: tuple = ()


class CurrentUserView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(CurrentUserSerializer(request.user).data)


class IsProjectHubAdmin(BasePermission):
    message = "Admin access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_staff
                or user.is_superuser
                or UserProfile.objects.filter(
                    user=user,
                    role=UserProfile.Role.ADMIN,
                ).exists()
            )
        )


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class DashboardView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        counts = {
            row["status"]: row["total"]
            for row in Project.objects.filter(owner=request.user)
            .values("status")
            .annotate(total=Count("id"))
        }
        snapshots = ProjectSnapshot.objects.filter(owner=request.user).order_by("-day")[
            :7
        ]
        return Response(
            {
                "total": sum(counts.values()),
                "backlog": counts.get(Project.Status.BACKLOG, 0),
                "in_progress": counts.get(Project.Status.IN_PROGRESS, 0),
                "completed": counts.get(Project.Status.COMPLETED, 0),
                "snapshots": ProjectSnapshotSerializer(snapshots, many=True).data,
            }
        )

    def post(self, request):
        task = record_project_snapshot.delay(request.user.id)
        return Response(
            {"task_id": task.id, "status": "queued"},
            status=status.HTTP_202_ACCEPTED,
        )


class AdminDashboardView(APIView):
    permission_classes = (IsAuthenticated, IsProjectHubAdmin)

    def get(self, request):
        counts = {
            row["status"]: row["total"]
            for row in Project.objects.values("status").annotate(total=Count("id"))
        }
        admin_count = User.objects.filter(
            Q(profile__role=UserProfile.Role.ADMIN)
            | Q(is_staff=True)
            | Q(is_superuser=True)
        ).distinct().count()
        return Response(
            {
                "total_users": User.objects.count(),
                "admin_users": admin_count,
                "total_projects": sum(counts.values()),
                "backlog": counts.get(Project.Status.BACKLOG, 0),
                "in_progress": counts.get(Project.Status.IN_PROGRESS, 0),
                "completed": counts.get(Project.Status.COMPLETED, 0),
            }
        )


class AdminUserListView(generics.ListAPIView):
    permission_classes = (IsAuthenticated, IsProjectHubAdmin)
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return (
            User.objects.select_related("profile")
            .annotate(project_count=Count("projects"))
            .order_by("-date_joined")
        )


class AdminUserRoleView(APIView):
    permission_classes = (IsAuthenticated, IsProjectHubAdmin)

    def patch(self, request, user_id: int):
        user = get_object_or_404(User.objects.select_related("profile"), pk=user_id)
        serializer = UserRoleUpdateSerializer(
            user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        return Response(CurrentUserSerializer(updated_user).data)


class ProjectPdfView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        from weasyprint import HTML

        projects = Project.objects.filter(owner=request.user).order_by("-updated_at")[
            :500
        ]
        html = render_to_string(
            "projects/projects_report.html",
            {"projects": projects, "generated_at": timezone.now()},
        )
        pdf = HTML(string=html).write_pdf()
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="project-report.pdf"'
        return response
