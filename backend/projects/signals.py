from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from projects.models import UserProfile

User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, **kwargs):
    role = (
        UserProfile.Role.ADMIN
        if instance.is_staff or instance.is_superuser
        else UserProfile.Role.USER
    )
    profile, created = UserProfile.objects.get_or_create(
        user=instance,
        defaults={"role": role},
    )
    if (
        not created
        and (instance.is_staff or instance.is_superuser)
        and profile.role != UserProfile.Role.ADMIN
    ):
        profile.role = UserProfile.Role.ADMIN
        profile.save(update_fields=("role", "updated_at"))
