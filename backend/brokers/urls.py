from django.urls import path

from brokers.views import BrokerMemberDetailView, BrokerMemberListView

urlpatterns = [
    path(
        "brokers/<uuid:broker_id>/members/",
        BrokerMemberListView.as_view(),
        name="broker-members",
    ),
    path(
        "brokers/<uuid:broker_id>/members/<uuid:membership_id>/",
        BrokerMemberDetailView.as_view(),
        name="broker-member-detail",
    ),
]
