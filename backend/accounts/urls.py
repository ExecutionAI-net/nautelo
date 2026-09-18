from django.urls import path

from accounts.views import (
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
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="auth-resend-verification",
    ),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/token/refresh/", RefreshView.as_view(), name="auth-token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("session/", SessionView.as_view(), name="session"),
    path("account/", AccountView.as_view(), name="account"),
]
