from django import forms

from brokers.models import BrokerOrganization


class BrokerOrganizationAdminForm(forms.ModelForm):
    """Adds the mandatory reason spec §21 rule 4 requires to the admin form.

    Django admin is a real write path into `auto_approve_listings` — `brokers.
    admin.BrokerOrganizationAdmin.save_model` routes it through
    `set_broker_auto_approval` — so leaving the reason to the API form alone
    would leave one audited rule with an unaudited back door. Spec §26's
    definition of done ("Staff can operate every new workflow without Django
    shell/database edits") means the admin stays usable, not that it stays
    unaudited.

    The field is not on the model: the reason belongs to the *event*, and the
    event lives in `audit.AuditEvent`, not in a column that only ever holds the
    most recent one.
    """

    auto_approve_reason = forms.CharField(
        label="Reason for the auto-approval change",
        required=False,
        max_length=500,
        widget=forms.Textarea(attrs={"rows": 2}),
        help_text=(
            "Required when the auto-approval switch changes. Stored in the audit "
            "trail. The change affects future submissions only."
        ),
    )

    class Meta:
        model = BrokerOrganization
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        # `changed_data` does not contain a field the admin rendered read-only,
        # so a moderator — who cannot edit the flag at all — is never asked for
        # a reason they have no way to act on.
        if "auto_approve_listings" in self.changed_data and not (
            cleaned.get("auto_approve_reason") or ""
        ).strip():
            self.add_error(
                "auto_approve_reason",
                "Explain why this broker's auto-approval policy is changing.",
            )
        return cleaned
