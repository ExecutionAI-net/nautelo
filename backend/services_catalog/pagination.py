from rest_framework.pagination import PageNumberPagination


class ProfessionalDirectoryPagination(PageNumberPagination):
    """12 per page — three rows of a four-column card grid at desktop width."""

    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48
