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
    NotificationType.LISTING_APPROVED: (
        _t("Your listing was approved", "Il tuo annuncio e stato approvato", "Tu anuncio fue aprobado"),
        _t("Your listing is now public on NAUTA.", "Il tuo annuncio e ora pubblico su NAUTA.", "Tu anuncio ya es publico en NAUTA."),
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
        _t("Renew or edit it before it leaves the marketplace.", "Rinnovalo o modificalo prima che esca dal marketplace.", "Renuevalo o editalo antes de que salga del mercado."),
    ),
    NotificationType.LISTING_EXPIRED: (
        _t("Your listing has expired", "Il tuo annuncio e scaduto", "Tu anuncio ha caducado"),
        _t("It is no longer public on NAUTA.", "Non e piu pubblico su NAUTA.", "Ya no es publico en NAUTA."),
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
