from rest_framework.pagination import PageNumberPagination


class TaxonomySearchPagination(PageNumberPagination):
    page_size = 20
    max_page_size = 100
