from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from weasyprint import HTML

from projects.models import Project, ProjectSnapshot
from projects.serializers import (
    ProjectSerializer,
    ProjectSnapshotSerializer,
    RegisterSerializer,
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


class ProjectPdfView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
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
