import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from accounts.models import User
from emailing.services import render_email

logger = logging.getLogger(__name__)

SUBJECTS = {
    "EN": "Confirm your Nautelo email address",
    "IT": "Conferma il tuo indirizzo email Nautelo",
    "ES": "Confirma tu direccion de correo Nautelo",
}
BODIES = {
    "EN": "Hello {name},\n\nConfirm your Nautelo account by opening:\n{url}\n\nThis link expires in 24 hours.",
    "IT": "Ciao {name},\n\nConferma il tuo account Nautelo aprendo:\n{url}\n\nIl link scade tra 24 ore.",
    "ES": "Hola {name},\n\nConfirma tu cuenta Nautelo abriendo:\n{url}\n\nEl enlace caduca en 24 horas.",
}


@shared_task(queue="notifications")
def send_email_verification_email(user_id: str, raw_token: str) -> None:
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        logger.warning("verification email skipped: user %s no longer exists", user_id)
        return

    locale = user.locale if user.locale in SUBJECTS else "EN"
    url = f"{settings.PUBLIC_BASE_URL}/verify-email?token={raw_token}"
    name = user.get_short_name()
    rendered = render_email("email_verification", locale, {"name": name, "url": url})
    send_mail(
        subject=rendered[0] if rendered else SUBJECTS[locale],
        message=BODIES[locale].format(name=name, url=url),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=rendered[1] if rendered else None,
    )
    logger.info("verification email sent", extra={"user_id": str(user.pk)})


RESET_SUBJECTS = {
    "EN": "Reset your Nautelo password",
    "IT": "Reimposta la tua password Nautelo",
    "ES": "Restablece tu contrasena Nautelo",
}
RESET_BODIES = {
    "EN": "Hello {name},\n\nChoose a new password by opening:\n{url}\n\nThis link expires in 1 hour. If you did not ask for it, ignore this email.",
    "IT": "Ciao {name},\n\nScegli una nuova password aprendo:\n{url}\n\nIl link scade tra 1 ora. Se non l'hai richiesto, ignora questa email.",
    "ES": "Hola {name},\n\nElige una nueva contrasena abriendo:\n{url}\n\nEl enlace caduca en 1 hora. Si no lo pediste, ignora este correo.",
}


@shared_task(queue="notifications")
def send_password_reset_email(user_id: str, raw_token: str) -> None:
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        return
    locale = user.locale if user.locale in RESET_SUBJECTS else "EN"
    url = f"{settings.PUBLIC_BASE_URL}/reset-password?token={raw_token}"
    name = user.get_short_name()
    rendered = render_email("password_reset", locale, {"name": name, "url": url})
    send_mail(
        subject=rendered[0] if rendered else RESET_SUBJECTS[locale],
        message=RESET_BODIES[locale].format(name=name, url=url),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=rendered[1] if rendered else None,
    )


INVITE_SUBJECTS = {
    "EN": "You have been invited to join {org} on Nautelo",
    "IT": "Sei stato invitato a unirti a {org} su Nautelo",
    "ES": "Has sido invitado a unirte a {org} en Nautelo",
}
INVITE_BODIES = {
    "EN": "Hello,\n\n{inviter} invited you to join {org} on Nautelo as {role}.\nAccept the invitation:\n{url}\n\nThe link expires in 7 days.",
    "IT": "Ciao,\n\n{inviter} ti ha invitato a unirti a {org} su Nautelo come {role}.\nAccetta l'invito:\n{url}\n\nIl link scade tra 7 giorni.",
    "ES": "Hola,\n\n{inviter} te ha invitado a unirte a {org} en Nautelo como {role}.\nAcepta la invitacion:\n{url}\n\nEl enlace caduca en 7 dias.",
}


@shared_task(queue="notifications")
def send_invitation_email(invitation_id: str, raw_token: str) -> None:
    from accounts.invitations import organization_name
    from accounts.models import OrganizationInvitation

    invitation = (
        OrganizationInvitation.objects.select_related("broker", "professional", "invited_by")
        .filter(pk=invitation_id, accepted_at__isnull=True, revoked_at__isnull=True)
        .first()
    )
    if invitation is None:
        return
    inviter = invitation.invited_by
    locale = inviter.locale if inviter and inviter.locale in INVITE_SUBJECTS else "EN"
    org = organization_name(invitation)
    url = f"{settings.PUBLIC_BASE_URL}/accept-invite?token={raw_token}"
    send_mail(
        subject=INVITE_SUBJECTS[locale].format(org=org),
        message=INVITE_BODIES[locale].format(
            inviter=(inviter.full_name or inviter.email) if inviter else "A colleague",
            org=org,
            role=invitation.role.title(),
            url=url,
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
    )
