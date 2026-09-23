"""Seeds EN/IT/ES default HTML for the 15 notification-driven templates added
in Phase 4 (see notifications/tasks.py's TEMPLATE_KEY_BY_TYPE), so a fresh
environment gets the branded, per-locale HTML look immediately instead of an
empty table. render_email() falls back to the EN row when a locale-specific
row is missing (emailing/services.py); seeding all three locales here -
matching the exact subject strings already localized in notifications/copy.py
and notifications/tasks.py's SUBJECTS dict - keeps that fallback from
silently overriding an IT/ES recipient's subject with English text. This is a
nice-to-have seed, not a correctness requirement: render_email() returns None
and the plain-text copy still sends when a row is missing. Staff can edit any
of these from the Phase 2 editor at any time.
"""

from django.db import migrations

CTA_BUTTON = (
    '<div style="text-align:center;margin:28px 0;">'
    '<a href="{{{{ url }}}}" style="background:#00696e;color:#ffffff;text-decoration:none;'
    "font-weight:700;padding:14px 32px;border-radius:6px;display:inline-block;\">{label}</a>"
    "</div>"
)


def _h1_p(title: str, body: str, cta_label: str | None = None) -> str:
    html = (
        f"<h1 style=\"margin:0 0 16px;font-size:22px;\">{title}</h1>"
        f"<p style=\"margin:0 0 12px;\">{body}</p>"
    )
    if cta_label:
        html += CTA_BUTTON.format(label=cta_label)
    return html


# (key, {locale: (subject, title, body, cta_label_or_None)})
TEMPLATES = {
    "new_message": {
        "EN": (
            "New message on Nautelo",
            "You Have a New Message",
            "{{ sender }} sent you a message about {{ context }} on Nautelo.</p>"
            "<p style=\"margin:0 0 12px;padding:16px;background:#f4f1ea;border-radius:6px;color:#3a3f3f;\">{{ excerpt }}",
            "Read and Reply",
        ),
        "IT": (
            "Nuovo messaggio su Nautelo",
            "Hai un nuovo messaggio",
            "{{ sender }} ti ha inviato un messaggio su {{ context }} tramite Nautelo.</p>"
            "<p style=\"margin:0 0 12px;padding:16px;background:#f4f1ea;border-radius:6px;color:#3a3f3f;\">{{ excerpt }}",
            "Leggi e Rispondi",
        ),
        "ES": (
            "Nuevo mensaje en Nautelo",
            "Tienes un nuevo mensaje",
            "{{ sender }} te ha enviado un mensaje sobre {{ context }} en Nautelo.</p>"
            "<p style=\"margin:0 0 12px;padding:16px;background:#f4f1ea;border-radius:6px;color:#3a3f3f;\">{{ excerpt }}",
            "Leer y Responder",
        ),
    },
    "listing_submission_received": {
        "EN": ("Your listing was submitted", "Your Listing Was Submitted", "Thanks for listing your vessel on Nautelo. It was received and is awaiting staff review.", "View Your Listings"),
        "IT": ("Il tuo annuncio e stato inviato", "Il tuo annuncio e stato inviato", "Grazie per aver pubblicato la tua imbarcazione su Nautelo. E stato ricevuto ed e in attesa di revisione.", "Vedi i tuoi annunci"),
        "ES": ("Tu anuncio fue enviado", "Tu anuncio fue enviado", "Gracias por publicar tu embarcacion en Nautelo. Fue recibido y esta pendiente de revision.", "Ver tus anuncios"),
    },
    "listing_approved": {
        "EN": ("Your listing was approved", "Your Listing Is Live", "Good news - your listing is now public on Nautelo.", "View Your Listings"),
        "IT": ("Il tuo annuncio e stato approvato", "Il tuo annuncio e ora pubblico", "Buone notizie: il tuo annuncio e ora pubblico su Nautelo.", "Vedi i tuoi annunci"),
        "ES": ("Tu anuncio fue aprobado", "Tu anuncio ya es publico", "Buenas noticias: tu anuncio ya es publico en Nautelo.", "Ver tus anuncios"),
    },
    "listing_changes_requested": {
        "EN": ("Changes requested on your listing", "Changes Requested", "A moderator asked for changes to your listing before it can be published.", "Review and Update"),
        "IT": ("Modifiche richieste al tuo annuncio", "Modifiche richieste", "Un moderatore ha chiesto modifiche al tuo annuncio prima della pubblicazione.", "Rivedi e aggiorna"),
        "ES": ("Cambios solicitados en tu anuncio", "Cambios solicitados", "Un moderador pidio cambios en tu anuncio antes de publicarlo.", "Revisar y actualizar"),
    },
    "listing_rejected": {
        "EN": ("Your listing was rejected", "Your Listing Was Rejected", "A moderator rejected your listing. Sign in to see the details.", "View Your Listings"),
        "IT": ("Il tuo annuncio e stato rifiutato", "Il tuo annuncio e stato rifiutato", "Un moderatore ha rifiutato il tuo annuncio. Accedi per i dettagli.", "Vedi i tuoi annunci"),
        "ES": ("Tu anuncio fue rechazado", "Tu anuncio fue rechazado", "Un moderador rechazo tu anuncio. Inicia sesion para ver los detalles.", "Ver tus anuncios"),
    },
    "listing_expiring": {
        "EN": ("Your listing is about to expire", "Your Listing Is About to Expire", "Buy a paid listing to extend it and unlock 20 photos and a video, or it leaves the marketplace.", "Extend Your Listing"),
        "IT": ("Il tuo annuncio sta per scadere", "Il tuo annuncio sta per scadere", "Acquista un annuncio a pagamento per prolungarlo e sbloccare 20 foto e un video, altrimenti esce dal marketplace.", "Prolunga il tuo annuncio"),
        "ES": ("Tu anuncio esta por caducar", "Tu anuncio esta por caducar", "Compra un anuncio de pago para prolongarlo y desbloquear 20 fotos y un video, o saldra del mercado.", "Prolongar tu anuncio"),
    },
    "listing_expired": {
        "EN": ("Your listing has expired", "Your Listing Has Expired", "It is no longer public on Nautelo.", "View Your Listings"),
        "IT": ("Il tuo annuncio e scaduto", "Il tuo annuncio e scaduto", "Non e piu pubblico su Nautelo.", "Vedi i tuoi annunci"),
        "ES": ("Tu anuncio ha caducado", "Tu anuncio ha caducado", "Ya no es publico en Nautelo.", "Ver tus anuncios"),
    },
    "broker_trial_started": {
        "EN": ("Your free trial has started", "Your Free Trial Has Started", "Your brokerage plan is set. Staff approval is what puts your brokerage live.", "Go to Your Dashboard"),
        "IT": ("La tua prova gratuita e iniziata", "La tua prova gratuita e iniziata", "Il piano della tua agenzia e attivo. L'approvazione dello staff pubblica la tua agenzia.", "Vai alla tua dashboard"),
        "ES": ("Tu prueba gratuita ha empezado", "Tu prueba gratuita ha empezado", "El plan de tu agencia esta activo. La aprobacion del personal publica tu agencia.", "Ir a tu panel"),
    },
    "broker_payment_failed": {
        "EN": ("Payment not received", "Payment Not Received", "We could not collect your brokerage subscription. Pay within 24 hours to keep your brokerage online.", "Update Payment"),
        "IT": ("Pagamento non ricevuto", "Pagamento non ricevuto", "Non abbiamo potuto incassare l'abbonamento della tua agenzia. Paga entro 24 ore per mantenerla online.", "Aggiorna il pagamento"),
        "ES": ("Pago no recibido", "Pago no recibido", "No pudimos cobrar la suscripcion de tu agencia. Paga en 24 horas para mantenerla en linea.", "Actualizar pago"),
    },
    "broker_suspended": {
        "EN": ("Your brokerage is suspended", "Your Brokerage Is Suspended", "The subscription is not active, so your vessels are offline. Pay to bring them back.", "Reactivate"),
        "IT": ("La tua agenzia e sospesa", "La tua agenzia e sospesa", "L'abbonamento non e attivo, quindi le tue imbarcazioni sono offline. Paga per riattivarle.", "Riattiva"),
        "ES": ("Tu agencia esta suspendida", "Tu agencia esta suspendida", "La suscripcion no esta activa, asi que tus embarcaciones estan fuera de linea. Paga para reactivarlas.", "Reactivar"),
    },
    "payment_fulfilled": {
        "EN": ("Your purchase is ready", "Your Purchase Is Ready", "Your payment was received and applied.", "View Details"),
        "IT": ("Il tuo acquisto e pronto", "Il tuo acquisto e pronto", "Il pagamento e stato ricevuto e applicato.", "Vedi i dettagli"),
        "ES": ("Tu compra esta lista", "Tu compra esta lista", "Tu pago fue recibido y aplicado.", "Ver detalles"),
    },
    "professional_activated": {
        "EN": ("Your professional profile is live", "Your Professional Profile Is Live", "Your payment was received. Your profile is now listed on Nautelo.", "View Your Profile"),
        "IT": ("Il tuo profilo professionale e attivo", "Il tuo profilo professionale e attivo", "Pagamento ricevuto. Il tuo profilo e ora pubblicato su Nautelo.", "Vedi il tuo profilo"),
        "ES": ("Tu perfil profesional esta activo", "Tu perfil profesional esta activo", "Pago recibido. Tu perfil ya esta publicado en Nautelo.", "Ver tu perfil"),
    },
    "professional_payment_failed": {
        "EN": ("Payment not received", "Payment Not Received", "We could not collect your monthly membership. Pay within 24 hours to keep your profile online.", "Update Payment"),
        "IT": ("Pagamento non ricevuto", "Pagamento non ricevuto", "Non abbiamo potuto incassare il tuo abbonamento mensile. Paga entro 24 ore per mantenere il profilo online.", "Aggiorna il pagamento"),
        "ES": ("Pago no recibido", "Pago no recibido", "No pudimos cobrar tu membresia mensual. Paga en 24 horas para mantener tu perfil en linea.", "Actualizar pago"),
    },
    "professional_deactivated": {
        "EN": ("Your professional profile is offline", "Your Professional Profile Is Offline", "Your membership is not active, so your profile is no longer listed. Pay to bring it back.", "Reactivate"),
        "IT": ("Il tuo profilo professionale e offline", "Il tuo profilo professionale e offline", "L'abbonamento non e attivo, quindi il profilo non e piu pubblicato. Paga per riattivarlo.", "Riattiva"),
        "ES": ("Tu perfil profesional esta fuera de linea", "Tu perfil profesional esta fuera de linea", "La membresia no esta activa, asi que tu perfil ya no se muestra. Paga para reactivarlo.", "Reactivar"),
    },
    "payment_fulfillment_failed": {
        "EN": ("Payment needs staff attention", "We Need to Check Your Payment", "A payment could not be fulfilled automatically. Our team has been notified and will follow up.", None),
        "IT": ("Pagamento da verificare", "Dobbiamo verificare il tuo pagamento", "Un pagamento non ha potuto essere completato automaticamente. Il nostro team e stato avvisato e ti ricontattera.", None),
        "ES": ("Pago requiere atencion del personal", "Necesitamos revisar tu pago", "Un pago no pudo cumplirse automaticamente. Nuestro equipo ha sido notificado y se pondra en contacto.", None),
    },
}


def seed_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("emailing", "EmailTemplate")
    for key, per_locale in TEMPLATES.items():
        for locale, (subject, title, body, cta_label) in per_locale.items():
            EmailTemplate.objects.update_or_create(
                key=key,
                locale=locale,
                defaults={"subject": subject, "html_body": _h1_p(title, body, cta_label)},
            )


def remove_templates(apps, schema_editor):
    EmailTemplate = apps.get_model("emailing", "EmailTemplate")
    EmailTemplate.objects.filter(key__in=list(TEMPLATES)).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("emailing", "0002_seed_default_templates"),
    ]

    operations = [
        migrations.RunPython(seed_templates, remove_templates),
    ]
