"""Django email backend that sends through ZeptoMail's HTTP API.

Point EMAIL_BACKEND at this class (see .env.example) and every existing
send_mail()/EmailMultiAlternatives call in the codebase - no other code
changes - starts going through ZeptoMail. Local dev keeps using the console
backend; only a deployment with ZEPTOMAIL_API_KEY set uses this.
"""

import logging

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class ZeptoMailBackend(BaseEmailBackend):
    def send_messages(self, email_messages) -> int:
        if not email_messages:
            return 0
        sent = 0
        for message in email_messages:
            if self._send_one(message):
                sent += 1
        return sent

    def _send_one(self, message) -> bool:
        html_body = next(
            (content for content, mimetype in getattr(message, "alternatives", []) if mimetype == "text/html"),
            None,
        )
        payload = {
            "from": {"address": message.from_email},
            "to": [{"email_address": {"address": address}} for address in message.to],
            "subject": message.subject,
            "textbody": message.body,
        }
        if html_body:
            payload["htmlbody"] = html_body
        if message.cc:
            payload["cc"] = [{"email_address": {"address": address}} for address in message.cc]
        if message.bcc:
            payload["bcc"] = [{"email_address": {"address": address}} for address in message.bcc]

        api_key = settings.ZEPTOMAIL_API_KEY
        # ZeptoMail's API requires this exact scheme prefix on the token. The
        # console's own copy button includes it, so a key pasted from there
        # already has it - but the value stored in an env var/secret manager
        # commonly holds just the raw token, which 401s without this.
        authorization = api_key if api_key.startswith("Zoho-enczapikey") else f"Zoho-enczapikey {api_key}"

        try:
            response = requests.post(
                settings.ZEPTOMAIL_API_URL,
                json=payload,
                headers={
                    "Authorization": authorization,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException:
            logger.exception("zeptomail send failed", extra={"to": message.to})
            if not self.fail_silently:
                raise
            return False
        return True
