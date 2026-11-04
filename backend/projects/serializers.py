from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from projects.models import Project, ProjectSnapshot, UserProfile

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


class CurrentUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "role")

    def get_role(self, user: User) -> str:
        if user.is_staff or user.is_superuser:
            return UserProfile.Role.ADMIN
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile.role


class AdminUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    project_count = serializers.IntegerField(read_only=True)
    role_locked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "role",
            "project_count",
            "date_joined",
            "role_locked",
        )
        read_only_fields = fields

    def get_role(self, user: User) -> str:
        if user.is_staff or user.is_superuser:
            return UserProfile.Role.ADMIN
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile.role

    def get_role_locked(self, user: User) -> bool:
        return bool(user.is_staff or user.is_superuser)


class UserRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserProfile.Role.choices)

    def validate_role(self, role: str) -> str:
        user = self.instance
        request = self.context["request"]
        if role == UserProfile.Role.USER:
            if user.pk == request.user.pk:
                raise serializers.ValidationError("You cannot remove your own admin role.")
            if user.is_staff or user.is_superuser:
                raise serializers.ValidationError(
                    "Django staff accounts keep their admin role."
                )
            admins = User.objects.filter(
                Q(profile__role=UserProfile.Role.ADMIN)
                | Q(is_staff=True)
                | Q(is_superuser=True)
            ).distinct().count()
            if user.profile.role == UserProfile.Role.ADMIN and admins <= 1:
                raise serializers.ValidationError(
                    "At least one admin account must remain."
                )
        return role

    def update(self, instance: User, validated_data: dict[str, str]) -> User:
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        profile.role = validated_data["role"]
        profile.save(update_fields=("role", "updated_at"))
        return instance


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
