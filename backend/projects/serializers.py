from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from projects.models import Project, ProjectSnapshot

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    email = serializers.EmailField(
        validators=[UniqueValidator(queryset=User.objects.all())],
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")
        read_only_fields = ("id",)

    def create(self, validated_data: dict[str, str]) -> User:
        return User.objects.create_user(**validated_data)


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("id", "title", "description", "status", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ProjectSnapshotSerializer(serializers.ModelSerializer):
    total_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectSnapshot
        fields = (
            "day",
            "backlog_count",
            "in_progress_count",
            "completed_count",
            "total_count",
        )

    def get_total_count(self, snapshot: ProjectSnapshot) -> int:
        return (
            snapshot.backlog_count
            + snapshot.in_progress_count
            + snapshot.completed_count
        )
