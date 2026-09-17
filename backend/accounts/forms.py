from django.contrib.auth import forms as auth_forms

from accounts.models import User


class AdminUserCreationForm(auth_forms.BaseUserCreationForm):
    class Meta(auth_forms.BaseUserCreationForm.Meta):
        model = User
        fields = ("email",)
        field_classes = {}


class AdminUserChangeForm(auth_forms.UserChangeForm):
    class Meta(auth_forms.UserChangeForm.Meta):
        model = User
        fields = "__all__"
        field_classes = {}
