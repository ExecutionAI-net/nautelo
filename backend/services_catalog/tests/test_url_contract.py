"""Contract test: every route this app registers is flag-gated and throttled.

The plan's Contract summary rule 4 requires every directory-facing read
endpoint to declare `permission_classes = [AllowAny, CombinedDirectoryEnabled]`
and `throttle_scope = "services_directory"`. That rule is prose, and prose does
not fail a build. Each endpoint's own test file asserts its own gating, so a
*new* endpoint added to `services_catalog/urls.py` without the flag gate or
without the shared throttle scope is exactly the case nothing catches: a
silently public, silently unthrottled read surface with no failing test
anywhere. This file sweeps the URL conf itself, so the new route is covered the
moment it is registered rather than only if someone remembers to test it.
"""

import pytest

from services_catalog.permissions import CombinedDirectoryEnabled
from services_catalog.urls import urlpatterns

DIRECTORY_THROTTLE_SCOPE = "services_directory"


def registered_views():
    """(route name, view class) for every pattern in this app's URL conf."""
    for pattern in urlpatterns:
        callback = pattern.callback
        # DRF's APIView.as_view() attaches the class as `.cls`; a plain Django
        # class-based view exposes `.view_class`. A function-based view has
        # neither and yields None, which the first test below turns into a
        # failure rather than a silent skip — a route with no class attributes
        # is a route this sweep cannot vouch for.
        view_class = getattr(callback, "cls", None) or getattr(callback, "view_class", None)
        yield pattern.name, view_class


REGISTERED_VIEWS = list(registered_views())


def test_the_url_conf_registers_routes_for_this_sweep_to_check():
    # Guards against the whole file passing vacuously if urlpatterns is ever
    # emptied or moved.
    assert REGISTERED_VIEWS


def test_every_registered_route_resolves_to_a_class_based_view():
    assert [name for name, view_class in REGISTERED_VIEWS if view_class is None] == []


@pytest.mark.parametrize(("name", "view_class"), REGISTERED_VIEWS)
def test_every_registered_view_is_gated_by_the_rollout_flag(name, view_class):
    assert CombinedDirectoryEnabled in view_class.permission_classes, (
        f"{name} ({view_class.__name__}) is missing CombinedDirectoryEnabled: it would stay "
        "reachable with combined_services_professionals off (Contract rule 4)."
    )


@pytest.mark.parametrize(("name", "view_class"), REGISTERED_VIEWS)
def test_every_registered_view_uses_the_shared_directory_throttle_scope(name, view_class):
    assert getattr(view_class, "throttle_scope", None) == DIRECTORY_THROTTLE_SCOPE, (
        f"{name} ({view_class.__name__}) must declare "
        f'throttle_scope = "{DIRECTORY_THROTTLE_SCOPE}" (Contract rule 4).'
    )
