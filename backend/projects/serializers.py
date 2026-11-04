from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from projects.models import Project, ProjectSnapshot, UserProfile

if TYPE_CHECKING:
    from django.contrib.auth.models import User
else:
    User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")
        read_only_fields = ("id",)

    def create(self, validated_data: dict[str, str]) -> User:
        return User.objects.create_user(**validated_data)

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        candidate = User(username=attrs["username"], email=attrs["email"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error
        return attrs


class CurrentUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "role")

    def get_role(self, user: User) -> str:
        if user.is_staff or user.is_superuser:
            return UserProfile.Role.ADMIN
        return user.profile.role


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
        return user.profile.role

    def get_role_locked(self, user: User) -> bool:
        return bool(user.is_staff or user.is_superuser)


class UserRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserProfile.Role.choices)

    def update(self, instance: User, validated_data: dict[str, str]) -> User:
        role = validated_data["role"]
        request = self.context["request"]

        with transaction.atomic():
            admin_profiles = list(
                UserProfile.objects.select_for_update()
                .filter(role=UserProfile.Role.ADMIN)
                .order_by("pk")
                .values_list("pk", flat=True)
            )
            user = User.objects.get(pk=instance.pk)
            profile = UserProfile.objects.select_for_update().get(user=user)

            if role == profile.role:
                return user

            if role == UserProfile.Role.USER:
                if user.pk == request.user.pk:
                    raise serializers.ValidationError(
                        "You cannot remove your own admin role."
                    )
                if user.is_staff or user.is_superuser:
                    raise serializers.ValidationError(
                        "Django staff accounts keep their admin role."
                    )

                if profile.role == UserProfile.Role.ADMIN and len(admin_profiles) <= 1:
                    raise serializers.ValidationError(
                        "At least one admin account must remain."
                    )

            profile.role = role
            profile.save(update_fields=("role", "updated_at"))

        return user


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
