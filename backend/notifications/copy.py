"""Localized notification text (spec 27.3, 37).

Keys are the `title_key` / `body_key` stored on each Notification; the frontend
resolves the same keys from its own dictionary, and the email task resolves them
here. English is the fallback for any locale without an entry.
"""

from notifications.enums import NotificationType


def _t(en: str, it: str, es: str) -> dict:
    return {"EN": en, "IT": it, "ES": es}


TEXT = {
    NotificationType.LISTING_INITIAL_SUBMITTED: (
        _t("New listing awaiting review", "Nuovo annuncio da rivedere", "Nuevo anuncio pendiente de revision"),
        _t("A listing was submitted for approval.", "Un annuncio e stato inviato per approvazione.", "Se envio un anuncio para su aprobacion."),
    ),
    NotificationType.LISTING_REVISION_SUBMITTED: (
        _t("Listing revision awaiting review", "Revisione annuncio da rivedere", "Revision de anuncio pendiente"),
        _t("A listing revision was submitted for approval.", "Una revisione e stata inviata per approvazione.", "Se envio una revision para su aprobacion."),
    ),
    NotificationType.LISTING_OTHER_MODEL_SUBMITTED: (
        _t("New boat model to map", "Nuovo modello da mappare", "Nuevo modelo por asignar"),
        _t("A listing uses the Other model and needs a taxonomy decision.", "Un annuncio usa il modello Altro e richiede una decisione.", "Un anuncio usa el modelo Otro y requiere una decision."),
    ),
    NotificationType.LISTING_SUBMISSION_RECEIVED: (
        _t("Your listing was submitted", "Il tuo annuncio e stato inviato", "Tu anuncio fue enviado"),
        _t("Your listing was received and is awaiting staff review.", "Il tuo annuncio e stato ricevuto ed e in attesa di revisione.", "Tu anuncio fue recibido y esta pendiente de revision."),
    ),
    NotificationType.LISTING_APPROVED: (
        _t("Your listing was approved", "Il tuo annuncio e stato approvato", "Tu anuncio fue aprobado"),
        _t("Your listing is now public on Nautelo.", "Il tuo annuncio e ora pubblico su Nautelo.", "Tu anuncio ya es publico en Nautelo."),
    ),
    NotificationType.LISTING_CHANGES_REQUESTED: (
        _t("Changes requested on your listing", "Modifiche richieste al tuo annuncio", "Cambios solicitados en tu anuncio"),
        _t("A moderator asked for changes before publishing.", "Un moderatore ha chiesto modifiche prima della pubblicazione.", "Un moderador pidio cambios antes de publicar."),
    ),
    NotificationType.LISTING_REJECTED: (
        _t("Your listing was rejected", "Il tuo annuncio e stato rifiutato", "Tu anuncio fue rechazado"),
        _t("A moderator rejected your listing.", "Un moderatore ha rifiutato il tuo annuncio.", "Un moderador rechazo tu anuncio."),
    ),
    NotificationType.LISTING_EXPIRING: (
        _t("Your listing is about to expire", "Il tuo annuncio sta per scadere", "Tu anuncio esta por caducar"),
        _t("Buy a paid listing to extend it and unlock 20 photos and a video, or it leaves the marketplace.", "Acquista un annuncio a pagamento per prolungarlo e sbloccare 20 foto e un video, altrimenti esce dal marketplace.", "Compra un anuncio de pago para prolongarlo y desbloquear 20 fotos y un video, o saldra del mercado."),
    ),
    NotificationType.LISTING_EXPIRED: (
        _t("Your listing has expired", "Il tuo annuncio e scaduto", "Tu anuncio ha caducado"),
        _t("It is no longer public on Nautelo.", "Non e piu pubblico su Nautelo.", "Ya no es publico en Nautelo."),
    ),
    NotificationType.PROFESSIONAL_ACTIVATED: (
        _t("Your professional profile is live", "Il tuo profilo professionale e attivo", "Tu perfil profesional esta activo"),
        _t("Your payment was received. Your profile is now listed on Nautelo.", "Pagamento ricevuto. Il tuo profilo e ora pubblicato su Nautelo.", "Pago recibido. Tu perfil ya esta publicado en Nautelo."),
    ),
    NotificationType.PROFESSIONAL_PAYMENT_FAILED: (
        _t("Payment not received", "Pagamento non ricevuto", "Pago no recibido"),
        _t("We could not collect your monthly membership. Pay within 24 hours to keep your profile online.", "Non abbiamo potuto incassare il tuo abbonamento mensile. Paga entro 24 ore per mantenere il profilo online.", "No pudimos cobrar tu membresia mensual. Paga en 24 horas para mantener tu perfil en linea."),
    ),
    NotificationType.PROFESSIONAL_DEACTIVATED: (
        _t("Your professional profile is offline", "Il tuo profilo professionale e offline", "Tu perfil profesional esta fuera de linea"),
        _t("Your membership is not active, so your profile is no longer listed. Pay to bring it back.", "L abbonamento non e attivo, quindi il profilo non e piu pubblicato. Paga per riattivarlo.", "La membresia no esta activa, asi que tu perfil ya no se muestra. Paga para reactivarlo."),
    ),
    NotificationType.BROKER_TRIAL_STARTED: (
        _t("Your free trial has started", "La tua prova gratuita e iniziata", "Tu prueba gratuita ha empezado"),
        _t("Your brokerage plan is set. Staff approval is what puts your brokerage live.", "Il piano della tua agenzia e attivo. L approvazione dello staff pubblica la tua agenzia.", "El plan de tu agencia esta activo. La aprobacion del personal publica tu agencia."),
    ),
    NotificationType.BROKER_PAYMENT_FAILED: (
        _t("Payment not received", "Pagamento non ricevuto", "Pago no recibido"),
        _t("We could not collect your brokerage subscription. Pay within 24 hours to keep your brokerage online.", "Non abbiamo potuto incassare l abbonamento della tua agenzia. Paga entro 24 ore per mantenerla online.", "No pudimos cobrar la suscripcion de tu agencia. Paga en 24 horas para mantenerla en linea."),
    ),
    NotificationType.BROKER_SUSPENDED: (
        _t("Your brokerage is suspended", "La tua agenzia e sospesa", "Tu agencia esta suspendida"),
        _t("The subscription is not active, so your vessels are offline. Pay to bring them back.", "L abbonamento non e attivo, quindi le tue imbarcazioni sono offline. Paga per riattivarle.", "La suscripcion no esta activa, asi que tus embarcaciones estan fuera de linea. Paga para reactivarlas."),
    ),
    NotificationType.PAYMENT_FULFILLED: (
        _t("Your purchase is ready", "Il tuo acquisto e pronto", "Tu compra esta lista"),
        _t("Your payment was received and applied.", "Il pagamento e stato ricevuto e applicato.", "Tu pago fue recibido y aplicado."),
    ),
    NotificationType.PAYMENT_FULFILLMENT_FAILED: (
        _t("Payment needs staff attention", "Pagamento da verificare", "Pago requiere atencion del personal"),
        _t("A payment could not be fulfilled automatically.", "Un pagamento non ha potuto essere completato automaticamente.", "Un pago no pudo cumplirse automaticamente."),
    ),
}


def keys_for(notification_type: str) -> tuple[str, str]:
    base = f"notification.{notification_type.replace('.', '_')}"
    return f"{base}.title", f"{base}.body"


def text_for(notification_type: str, locale: str) -> tuple[str, str] | None:
    entry = TEXT.get(notification_type)
    if entry is None:
        return None
    title, body = entry
    return title.get(locale) or title["EN"], body.get(locale) or body["EN"]
