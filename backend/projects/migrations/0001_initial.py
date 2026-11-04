import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Project",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True, max_length=1200)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("backlog", "Backlog"),
                            ("in_progress", "In progress"),
                            ("completed", "Completed"),
                        ],
                        default="backlog",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="projects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-updated_at", "-id"),
            },
        ),
        migrations.CreateModel(
            name="ProjectSnapshot",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("day", models.DateField()),
                ("backlog_count", models.PositiveIntegerField(default=0)),
                ("in_progress_count", models.PositiveIntegerField(default=0)),
                ("completed_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_snapshots",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("day",),
                "constraints": [
                    models.UniqueConstraint(
                        fields=("owner", "day"),
                        name="one_project_snapshot_per_owner_day",
                    )
                ],
            },
        ),
    ]
