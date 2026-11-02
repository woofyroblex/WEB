from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from projects.models import Project, ProjectSnapshot
from projects.tasks import record_project_snapshot

User = get_user_model()


class ProjectApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rijin",
            email="rijin@example.com",
            password="a-long-test-password-123",
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="another-long-password-123",
        )
        self.client = APIClient()

    def test_registration_and_jwt_login(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new-user",
                "email": "new@example.com",
                "password": "a-unique-long-password-123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("password", response.data)

        token_response = self.client.post(
            "/api/auth/token/",
            {"username": "new-user", "password": "a-unique-long-password-123"},
            format="json",
        )
        self.assertEqual(token_response.status_code, 200)
        self.assertIn("access", token_response.data)
        self.assertIn("refresh", token_response.data)

    def test_projects_are_private_to_their_owner(self):
        Project.objects.create(owner=self.user, title="My project")
        Project.objects.create(owner=self.other_user, title="Other project")
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/projects/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [project["title"] for project in response.data], ["My project"]
        )

    def test_project_can_be_created_and_dashboard_counts_it(self):
        self.client.force_authenticate(self.user)
        create_response = self.client.post(
            "/api/projects/",
            {"title": "Website refresh", "description": "Ship the dashboard"},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["status"], Project.Status.BACKLOG)

        dashboard_response = self.client.get("/api/dashboard/")
        self.assertEqual(dashboard_response.data["total"], 1)
        self.assertEqual(dashboard_response.data["backlog"], 1)

    def test_pdf_report_is_returned_for_signed_in_user(self):
        Project.objects.create(owner=self.user, title="PDF project")
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/reports/projects.pdf")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_snapshot_task_updates_one_daily_record(self):
        project = Project.objects.create(owner=self.user, title="Snapshot project")

        first_id = record_project_snapshot.run(self.user.id)
        project.status = Project.Status.COMPLETED
        project.save()
        second_id = record_project_snapshot.run(self.user.id)

        self.assertEqual(first_id, second_id)
        self.assertEqual(ProjectSnapshot.objects.filter(owner=self.user).count(), 1)
        self.assertEqual(
            ProjectSnapshot.objects.get(owner=self.user).completed_count,
            1,
        )
