from django.urls import path

from messaging.views import InquiryConfigView, InquiryCreateView

urlpatterns = [
    path("inquiries/", InquiryCreateView.as_view(), name="inquiry-create"),
    path("inquiries/config/", InquiryConfigView.as_view(), name="inquiry-config"),
]
