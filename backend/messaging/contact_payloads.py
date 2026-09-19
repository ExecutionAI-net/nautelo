"""Spec §16's wire shapes. Serialization only — no queries, no rules.

Kept apart from contact_access.py so the exact key set of each state can be
asserted without a database, and so a reviewer can read every field that ever
reaches a client in one screen.
"""

from .contact_access import GrantedContact, LockedContact, UnavailableContact


def _isoformat(value) -> str:
    """Spec §30.2: ISO 8601 UTC. Same transform as get_public_settings()."""
    return value.isoformat().replace("+00:00", "Z")


def locked_payload(access: LockedContact) -> dict:
    return {
        "state": LockedContact.state,
        "email_mask": access.email_mask,
        "phone_mask": access.phone_mask,
        "unlock_rule": access.unlock_rule,
    }


def granted_payload(access: GrantedContact) -> dict:
    # `grant_id` is deliberately NOT serialized: it is an internal handle, and
    # nothing a viewer can call takes one.
    #
    # `granted_at` is null on the staff-bypass path (spec §5's staff row), where
    # no grant exists. The key is always present so a client never has to branch
    # on its absence — only on its value.
    return {
        "state": GrantedContact.state,
        "email": access.email,
        "phone": access.phone,
        "website_url": access.website_url,
        "granted_at": _isoformat(access.granted_at) if access.granted_at else None,
    }


def unavailable_payload(access: UnavailableContact) -> dict:
    return {"state": UnavailableContact.state}


def contact_payload(access) -> dict:
    """Spec §16's `{"contact": {...}}` envelope."""
    if isinstance(access, GrantedContact):
        body = granted_payload(access)
    elif isinstance(access, LockedContact):
        body = locked_payload(access)
    elif isinstance(access, UnavailableContact):
        body = unavailable_payload(access)
    else:
        raise TypeError(f"Not a contact access result: {type(access).__name__}")
    return {"contact": body}
