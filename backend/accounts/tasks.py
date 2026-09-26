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
INVITE_BUTTONS = {"EN": "Accept the invitation", "IT": "Accetta l'invito", "ES": "Aceptar la invitacion"}
#: Shown only when the invited address already belongs to a private seller who
#: is being invited into a brokerage: accepting retires their private space
#: for good (accounts.private_exit).
INVITE_PRIVATE_WARNINGS = {
    "EN": (
        "Important: you will lose your private seller area.",
        "This email address already has a private seller account on Nautelo. If you accept, it becomes a broker "
        "account permanently: your {listings} private listing(s) will be archived and removed from the site, your "
        "{rights} unused listing right(s) will be forfeited, and your conversations with buyers will be closed. "
        "This cannot be undone.",
    ),
    "IT": (
        "Importante: perderai la tua area di venditore privato.",
        "Questo indirizzo email ha gia un account da venditore privato su Nautelo. Se accetti, diventera "
        "definitivamente un account broker: i tuoi {listings} annunci privati saranno archiviati e rimossi dal sito, "
        "i tuoi {rights} diritti di pubblicazione non utilizzati andranno persi e le conversazioni con gli acquirenti "
        "saranno chiuse. L'operazione non e reversibile.",
    ),
    "ES": (
        "Importante: perderas tu area de vendedor particular.",
        "Esta direccion de correo ya tiene una cuenta de vendedor particular en Nautelo. Si aceptas, pasara a ser "
        "una cuenta de broker de forma permanente: tus {listings} anuncios particulares se archivaran y se retiraran "
        "del sitio, perderas tus {rights} derechos de publicacion sin usar y se cerraran tus conversaciones con "
        "compradores. No se puede deshacer.",
    ),
}


def _invitation_locale(invitation) -> str:
    """The recipient's own language when they already have an account,
    otherwise the inviter's, otherwise English."""
    recipient = User.objects.filter(email=invitation.email).first()
    for person in (recipient, invitation.invited_by):
        if person is not None and person.locale in INVITE_SUBJECTS:
            return person.locale
    return "EN"


def _invitation_html(*, locale, inviter, org, role, url, warning) -> str:
    from django.utils.html import escape

    from emailing.layout import BRAND_TEAL, wrap_in_layout

    parts = []
    if warning is not None:
        title, text = INVITE_PRIVATE_WARNINGS[locale]
        parts.append(
            '<div style="margin:0 0 24px;padding:16px;border:2px solid #b3261e;border-radius:8px;background:#fdecea;">'
            f'<p style="margin:0 0 8px;font-size:20px;line-height:1.35;font-weight:700;color:#b3261e;">{escape(title)}</p>'
            f'<p style="margin:0;font-size:17px;line-height:1.5;font-weight:600;color:#b3261e;">'
            f"{escape(text.format(listings=warning['listings'], rights=warning['unused_rights']))}</p>"
            "</div>"
        )
    body = INVITE_BODIES[locale].format(inviter=inviter, org=org, role=role, url="")
    lines = [line for line in body.split("\n") if line.strip()]
    for line in lines[:-1]:
        parts.append(f'<p style="margin:0 0 12px;">{escape(line)}</p>')
    parts.append(
        f'<p style="margin:24px 0;"><a href="{escape(url)}" style="display:inline-block;padding:12px 24px;'
        f'background:{BRAND_TEAL};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">'
        f"{escape(INVITE_BUTTONS[locale])}</a></p>"
    )
    parts.append(f'<p style="margin:0 0 8px;font-size:13px;">{escape(lines[-1])}</p>')
    parts.append(f'<p style="margin:0;font-size:12px;color:#5f6b6c;word-break:break-all;">{escape(url)}</p>')
    return wrap_in_layout("\n".join(parts))


@shared_task(queue="notifications")
def send_invitation_email(invitation_id: str, raw_token: str) -> None:
    from accounts.invitations import organization_name, private_seller_warning
    from accounts.models import OrganizationInvitation

    invitation = (
        OrganizationInvitation.objects.select_related("broker", "professional", "invited_by")
        .filter(pk=invitation_id, accepted_at__isnull=True, revoked_at__isnull=True)
        .first()
    )
    if invitation is None:
        return
    inviter = invitation.invited_by
    locale = _invitation_locale(invitation)
    org = organization_name(invitation)
    url = f"{settings.PUBLIC_BASE_URL}/accept-invite?token={raw_token}"
    inviter_name = (inviter.full_name or inviter.email) if inviter else "A colleague"
    role = invitation.role.title()
    warning = private_seller_warning(invitation)
    text = INVITE_BODIES[locale].format(inviter=inviter_name, org=org, role=role, url=url)
    if warning is not None:
        title, detail = INVITE_PRIVATE_WARNINGS[locale]
        detail = detail.format(listings=warning["listings"], rights=warning["unused_rights"])
        text = f"{title.upper()}\n{detail}\n\n{text}"
    send_mail(
        subject=INVITE_SUBJECTS[locale].format(org=org),
        message=text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        html_message=_invitation_html(
            locale=locale, inviter=inviter_name, org=org, role=role, url=url, warning=warning
        ),
    )
