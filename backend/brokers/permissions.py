from rest_framework.permissions import BasePermission

from accounts.services import active_broker_membership


class IsBrokerMember(BasePermission):
    """View-level: the caller holds a live membership of view.kwargs['broker_id'].

    Mirrors accounts.permissions.IsBrokerTeamManager's shape, but gates on mere
    membership: spec 28's broker home shows organization-level counts, which
    every member of the organization may see. The narrower `can_read_messages`
    capability is applied inside the payload, per metric, not here — an AGENT
    must still be able to load their own dashboard.

    Deliberately NOT satisfied by staff. `active_broker_membership` returns None
    for a moderator with no membership, which matches Phase 6's ruling that this
    project ships no staff inbox read path (spec 5's capability table gives staff
    no such row). Staff read a brokerage through Phase 12's
    `GET /api/v1/staff/brokers/<id>/`, which spec 21 specifies with a screen in
    front of it.

    Also the reason an unknown broker id answers 403 rather than 404: this runs
    before any object lookup, so "no such organization" and "not your
    organization" are indistinguishable, and an outsider cannot enumerate ids.
    """

    message = "You are not a member of this broker organization."
    code = "not_broker_member"

    def has_permission(self, request, view):
        broker_id = getattr(view, "kwargs", {}).get("broker_id")
        return active_broker_membership(request.user, broker_id) is not None


class IsBrokerBilling(BasePermission):
    """Members read the subscription; team managers change it. Any brokerage status."""

    message = "You cannot manage this brokerage's subscription."
    code = "not_broker_billing"

    def has_permission(self, request, view):
        from accounts.services import broker_membership_in

        membership = broker_membership_in(request.user, getattr(view, "kwargs", {}).get("broker_id"))
        if membership is None:
            return False
        return request.method in ("GET", "HEAD", "OPTIONS") or membership.can_manage_team
