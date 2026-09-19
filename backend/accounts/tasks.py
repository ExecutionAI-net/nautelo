import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from accounts.models import User

logger = logging.getLogger(__name__)

SUBJECTS = {
    "EN": "Confirm your NAUTA email address",
    "IT": "Conferma il tuo indirizzo email NAUTA",
    "ES": "Confirma tu direccion de correo NAUTA",
}
BODIES = {
    "EN": "Hello {name},\n\nConfirm your NAUTA account by opening:\n{url}\n\nThis link expires in 24 hours.",
    "IT": "Ciao {name},\n\nConferma il tuo account NAUTA aprendo:\n{url}\n\nIl link scade tra 24 ore.",
    "ES": "Hola {name},\n\nConfirma tu cuenta NAUTA abriendo:\n{url}\n\nEl enlace caduca en 24 horas.",
}


@shared_task(queue="notifications")
def send_email_verification_email(user_id: str, raw_token: str) -> None:
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        logger.warning("verification email skipped: user %s no longer exists", user_id)
        return

    locale = user.locale if user.locale in SUBJECTS else "EN"
    url = f"{settings.PUBLIC_BASE_URL}/verify-email?token={raw_token}"
    send_mail(
        subject=SUBJECTS[locale],
        message=BODIES[locale].format(name=user.get_short_name(), url=url),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
    logger.info("verification email sent", extra={"user_id": str(user.pk)})


RESET_SUBJECTS = {
    "EN": "Reset your NAUTA password",
    "IT": "Reimposta la tua password NAUTA",
    "ES": "Restablece tu contrasena NAUTA",
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
    send_mail(
        subject=RESET_SUBJECTS[locale],
        message=RESET_BODIES[locale].format(name=user.get_short_name(), url=url),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
