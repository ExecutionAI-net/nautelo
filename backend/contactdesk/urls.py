from django.urls import path

from .views import ContactRequestView

urlpatterns = [path("contact/", ContactRequestView.as_view(), name="contact-request")]
