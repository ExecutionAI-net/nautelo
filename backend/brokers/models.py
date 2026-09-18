from django.conf import settings
from django.db import models

from brokers.enums import (
    ROLE_DEFAULT_CAPABILITIES,
    BrokerMembershipRole,
    BrokerOrganizationStatus,
)
from common.models import UUIDTimeStampedModel


class BrokerOrganization(UUIDTimeStampedModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    status = models.CharField(
        max_length=10,
        choices=BrokerOrganizationStatus.choices,
        default=BrokerOrganizationStatus.DRAFT,
    )
    public_email = models.EmailField(max_length=254)
    public_phone = models.CharField(max_length=32)
    website_url = models.URLField(max_length=300, blank=True, null=True)
    auto_approve_listings = models.BooleanField(default=False)
    auto_approve_changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="broker_auto_approve_changes",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    auto_approve_changed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(auto_approve_changed_by__isnull=True)
                | models.Q(auto_approve_changed_at__isnull=False),
                name="brokers_auto_approve_actor_requires_timestamp",
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def is_active(self) -> bool:
        return self.status == BrokerOrganizationStatus.ACTIVE


class BrokerMembership(UUIDTimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="broker_memberships",
        on_delete=models.CASCADE,
    )
    broker = models.ForeignKey(
        BrokerOrganization, related_name="memberships", on_delete=models.CASCADE
    )
    role = models.CharField(
        max_length=10,
        choices=BrokerMembershipRole.choices,
        default=BrokerMembershipRole.VIEWER,
    )
    can_edit_listings = models.BooleanField(default=False)
    can_manage_team = models.BooleanField(default=False)
    can_read_messages = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("broker__name", "user__email")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "broker"], name="brokers_membership_unique_user_broker"
            ),
            models.CheckConstraint(
                condition=~models.Q(role=BrokerMembershipRole.ADMIN)
                | models.Q(
                    can_edit_listings=True, can_manage_team=True, can_read_messages=True
                ),
                name="brokers_admin_membership_has_all_permissions",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.broker_id} ({self.role})"

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        # Remember the role as loaded, so save() can detect a role CHANGE.
        instance._loaded_role = instance.role
        return instance

    def refresh_from_db(self, *args, **kwargs):
        super().refresh_from_db(*args, **kwargs)
        self._loaded_role = self.role

    def save(self, *args, **kwargs):
        previous_role = getattr(self, "_loaded_role", None)
        forced = None
        if self.role == BrokerMembershipRole.ADMIN:
            # ADMIN always carries every capability (spec 5).
            forced = ROLE_DEFAULT_CAPABILITIES[BrokerMembershipRole.ADMIN]
        elif previous_role is not None and previous_role != self.role:
            # ANY role CHANGE resets the three flags to the new role's defaults.
            # The flags a member holds were granted for the rank they held, so a
            # member moved to a different rank starts again from that rank's
            # defaults. Scoping this to ADMIN->other only would leave a MANAGER
            # who was granted can_manage_team=True still holding it after being
            # demoted to AGENT or VIEWER - i.e. the same privilege-retention bug
            # one rung lower down.
            forced = ROLE_DEFAULT_CAPABILITIES[self.role]

        if forced is not None:
            for field, value in forced.items():
                setattr(self, field, value)
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | set(forced)

        result = super().save(*args, **kwargs)
        self._loaded_role = self.role
        return result
