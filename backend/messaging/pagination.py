from rest_framework.pagination import PageNumberPagination


class ConversationPagination(PageNumberPagination):
    """Spec 33.3: "Paginate every unbounded staff/public collection."

    Mirrors services_catalog.pagination.ProfessionalDirectoryPagination's shape
    so every paginated response in this project looks the same (spec 30.2:
    "Paginated results use one consistent shape").
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
