from django.urls import path

from common.org_image_views import (
    BrokerImageCompleteView,
    BrokerImageIntentView,
    ProfessionalImageCompleteView,
    ProfessionalImageIntentView,
)
from accounts.invitation_views import (
    BrokerInvitationView,
    InvitationAcceptView,
    InvitationPreviewView,
    OrganizationRegisterView,
    ProfessionalInvitationView,
)

from accounts.views import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    AccountView,
    LoginView,
    LogoutView,
    RefreshView,
    RegisterView,
    ResendVerificationView,
    SessionView,
    VerifyEmailView,
)

urlpatterns = [
    path("auth/invitations/preview/", InvitationPreviewView.as_view(), name="invitation-preview"),
    path("auth/invitations/accept/", InvitationAcceptView.as_view(), name="invitation-accept"),
    path("provider/team/invitations/", ProfessionalInvitationView.as_view(), name="provider-invitations"),
    path(
        "provider/team/invitations/<uuid:invitation_id>/",
        ProfessionalInvitationView.as_view(),
        name="provider-invitation-detail",
    ),
    path("brokers/<uuid:broker_id>/invitations/", BrokerInvitationView.as_view(), name="broker-invitations"),
    path(
        "brokers/<uuid:broker_id>/invitations/<uuid:invitation_id>/",
        BrokerInvitationView.as_view(),
        name="broker-invitation-detail",
    ),
    path("brokers/<uuid:broker_id>/images/intent/", BrokerImageIntentView.as_view(), name="broker-image-intent"),
    path("brokers/<uuid:broker_id>/images/complete/", BrokerImageCompleteView.as_view(), name="broker-image-complete"),
    path("provider/images/intent/", ProfessionalImageIntentView.as_view(), name="provider-image-intent"),
    path("provider/images/complete/", ProfessionalImageCompleteView.as_view(), name="provider-image-complete"),
    path("auth/register/organization/", OrganizationRegisterView.as_view(), name="auth-register-organization"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="auth-resend-verification",
    ),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/token/refresh/", RefreshView.as_view(), name="auth-token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("session/", SessionView.as_view(), name="session"),
    path("account/", AccountView.as_view(), name="account"),
]
