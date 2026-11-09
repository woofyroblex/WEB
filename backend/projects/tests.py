from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from projects.models import Project, ProjectSnapshot, UserProfile
from projects.tasks import record_all_project_snapshots, record_project_snapshot

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

    def test_daily_snapshots_use_constant_queries_for_all_owners(self):
        Project.objects.create(owner=self.user, title="Backlog project")
        Project.objects.create(
            owner=self.user,
            title="Completed project",
            status=Project.Status.COMPLETED,
        )
        Project.objects.create(
            owner=self.other_user,
            title="In-progress project",
            status=Project.Status.IN_PROGRESS,
        )
        previous_snapshot = ProjectSnapshot.objects.create(
            owner=self.user,
            day=timezone.localdate(),
            backlog_count=9,
            completed_count=9,
        )

        with self.assertNumQueries(2):
            snapshot_count = record_all_project_snapshots.run()

        self.assertEqual(snapshot_count, 2)
        previous_snapshot.refresh_from_db()
        self.assertEqual(previous_snapshot.backlog_count, 1)
        self.assertEqual(previous_snapshot.in_progress_count, 0)
        self.assertEqual(previous_snapshot.completed_count, 1)
        self.assertEqual(
            ProjectSnapshot.objects.get(owner=self.other_user).in_progress_count,
            1,
        )


class AccountRoleApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="workspace-admin",
            email="admin@example.com",
            password="secure-admin-password-2026",
        )
        self.admin.profile.role = UserProfile.Role.ADMIN
        self.admin.profile.save(update_fields=("role", "updated_at"))
        self.user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="secure-member-password-2026",
        )
        self.client = APIClient()

    def test_registration_keeps_user_role_and_normalizes_email(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new-member",
                "email": "NEW-MEMBER@EXAMPLE.COM",
                "password": "unrelated-password-2026",
                "role": "admin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created_user = User.objects.get(username="new-member")
        self.assertEqual(created_user.email, "new-member@example.com")
        self.assertEqual(created_user.profile.role, UserProfile.Role.USER)

    def test_registration_rejects_case_insensitive_duplicate_email(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "another-member",
                "email": "MEMBER@example.com",
                "password": "unrelated-password-2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_registration_rejects_password_similar_to_account_details(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "similar-name",
                "email": "similar@example.com",
                "password": "similar-name",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    def test_current_user_response_includes_role(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], UserProfile.Role.ADMIN)

    def test_regular_user_cannot_access_admin_endpoints(self):
        self.client.force_authenticate(self.user)

        dashboard = self.client.get("/api/admin/dashboard/")
        users = self.client.get("/api/admin/users/")
        role = self.client.patch(
            f"/api/admin/users/{self.user.pk}/role/",
            {"role": "admin"},
            format="json",
        )

        self.assertEqual(dashboard.status_code, 403)
        self.assertEqual(users.status_code, 403)
        self.assertEqual(role.status_code, 403)

    def test_admin_dashboard_counts_all_projects_without_returning_details(self):
        Project.objects.create(owner=self.admin, title="Admin work")
        Project.objects.create(owner=self.user, title="Member work")
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_users"], 2)
        self.assertEqual(response.data["admin_users"], 1)
        self.assertEqual(response.data["total_projects"], 2)
        self.assertNotIn("Admin work", str(response.data))
        self.assertNotIn("Member work", str(response.data))

    def test_admin_database_lists_safe_records_from_each_application_table(self):
        project = Project.objects.create(
            owner=self.user,
            title="Database project",
            description="Project details for administrators",
        )
        snapshot = ProjectSnapshot.objects.create(
            owner=self.user,
            day="2026-11-06",
            backlog_count=1,
        )
        self.client.force_authenticate(self.admin)

        users = self.client.get("/api/admin/database/?table=users")
        projects = self.client.get("/api/admin/database/?table=projects")
        snapshots = self.client.get("/api/admin/database/?table=snapshots")

        self.assertEqual(users.status_code, 200)
        member_record = next(
            row for row in users.data["results"] if row["id"] == self.user.pk
        )
        self.assertEqual(member_record["project_count"], 1)
        self.assertEqual(member_record["role"], UserProfile.Role.USER)
        self.assertNotIn("password", member_record)
        self.assertNotIn("is_superuser", member_record)
        self.assertEqual(projects.status_code, 200)
        self.assertEqual(projects.data["results"][0]["id"], project.pk)
        self.assertEqual(
            projects.data["results"][0]["owner_username"], self.user.username
        )
        self.assertEqual(
            projects.data["results"][0]["description"],
            "Project details for administrators",
        )
        self.assertEqual(snapshots.status_code, 200)
        self.assertEqual(snapshots.data["results"][0]["id"], snapshot.pk)
        self.assertEqual(
            snapshots.data["results"][0]["owner_username"],
            self.user.username,
        )

    def test_admin_database_requires_admin_and_rejects_unknown_table(self):
        self.client.force_authenticate(self.user)
        denied = self.client.get("/api/admin/database/?table=users")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.admin)
        invalid = self.client.get("/api/admin/database/?table=auth_user")
        self.assertEqual(invalid.status_code, 400)

    def test_admin_database_search_and_page_size_are_bounded(self):
        for index in range(30):
            Project.objects.create(owner=self.user, title=f"Project {index}")
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            "/api/admin/database/?table=projects&search=Project%2029&page_size=100"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Project 29")

    def test_admin_can_promote_and_demote_an_account(self):
        self.client.force_authenticate(self.admin)
        url = f"/api/admin/users/{self.user.pk}/role/"

        promote = self.client.patch(url, {"role": "admin"}, format="json")
        self.assertEqual(promote.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.role, UserProfile.Role.ADMIN)

        demote = self.client.patch(url, {"role": "user"}, format="json")
        self.assertEqual(demote.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.role, UserProfile.Role.USER)

    def test_role_update_requires_a_role(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            f"/api/admin/users/{self.user.pk}/role/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)

    def test_admin_cannot_remove_own_role_or_demote_django_staff(self):
        staff_user = User.objects.create_user(
            username="staff-admin",
            email="staff@example.com",
            password="secure-staff-password-2026",
            is_staff=True,
        )
        self.client.force_authenticate(self.admin)

        self_role = self.client.patch(
            f"/api/admin/users/{self.admin.pk}/role/",
            {"role": "user"},
            format="json",
        )
        staff_role = self.client.patch(
            f"/api/admin/users/{staff_user.pk}/role/",
            {"role": "user"},
            format="json",
        )

        self.assertEqual(self_role.status_code, 400)
        self.assertEqual(staff_role.status_code, 400)
