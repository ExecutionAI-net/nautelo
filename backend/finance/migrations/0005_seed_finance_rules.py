from django.db import migrations

# Illustrative starting assumptions gathered from public bank and broker pages. Staff replace them in the admin.
NOTE_LOAN = {
    "en": "A loan instalment carries no VAT. The VAT and taxes on buying the boat are paid separately.",
    "it": "La rata di un finanziamento non comprende IVA. IVA e imposte sull'acquisto della barca si pagano a parte.",
    "es": "La cuota de un préstamo no lleva IVA. El IVA y los impuestos de la compra del barco se pagan aparte.",
}
NOTE_LEASING_PRIVATE = {
    "en": "Leasing instalments carry VAT, which a private buyer cannot recover. The last payment is the purchase option.",
    "it": "I canoni di leasing includono IVA, che un privato non può recuperare. L'ultimo pagamento è il riscatto.",
    "es": "Las cuotas de leasing llevan IVA, que un particular no puede recuperar. El último pago es la opción de compra.",
}
NOTE_LEASING_COMPANY = {
    "en": "Companies can usually deduct the VAT on leasing instalments, but deduction depends on how the boat is used and is not automatic.",
    "it": "Le imprese di norma possono detrarre l'IVA sui canoni, ma la detrazione dipende dall'uso della barca e non è automatica.",
    "es": "Las empresas suelen poder deducir el IVA de las cuotas, pero depende del uso del barco y no es automático.",
}


def seed(apps, schema_editor):
    FinanceRule = apps.get_model("finance", "FinanceRule")
    markets = {
        "ES": {"vat": "21.00", "loan": ("5.900", "6.100", "6.900", "7.100"), "lease": ("5.500", "5.700", "6.500", "6.700"), "lease_terms": [5, 7, 10, 15], "lease_down": "20.00", "residual": "5.00"},
        "IT": {"vat": "22.00", "loan": ("5.700", "5.900", "6.700", "6.900"), "lease": ("5.300", "5.500", "6.300", "6.500"), "lease_terms": [5, 7, 8, 10, 12], "lease_down": "30.00", "residual": "1.00"},
    }
    order = 0
    for country, m in markets.items():
        for condition, (tin, tae) in (("NEW", m["loan"][:2]), ("USED", m["loan"][2:])):
            order += 1
            FinanceRule.objects.create(
                label=f"{country} loan {condition.lower()}", sort_order=order, country_code=country, product="LOAN", condition=condition, use="ANY",
                tin_percent=tin, tae_percent=tae, min_down_percent="10.00", max_down_percent="50.00", default_down_percent="20.00",
                terms_years=[5, 7, 10, 15], age_plus_term_limit=35 if condition == "USED" else None,
                note_en=NOTE_LOAN["en"], note_it=NOTE_LOAN["it"], note_es=NOTE_LOAN["es"],
            )
        for condition, (tin, tae) in (("NEW", m["lease"][:2]), ("USED", m["lease"][2:])):
            for use, note, recoverable in (("PRIVATE", NOTE_LEASING_PRIVATE, False), ("COMPANY", NOTE_LEASING_COMPANY, True)):
                order += 1
                FinanceRule.objects.create(
                    label=f"{country} leasing {condition.lower()} {use.lower()}", sort_order=order, country_code=country, product="LEASING",
                    condition=condition, use=use, tin_percent=tin, tae_percent=tae, residual_percent=m["residual"],
                    min_down_percent="0.00", max_down_percent="50.00", default_down_percent=m["lease_down"], terms_years=m["lease_terms"],
                    age_plus_term_limit=35 if condition == "USED" else None, vat_percent=m["vat"], vat_on_installment=True, vat_recoverable=recoverable,
                    note_en=note["en"], note_it=note["it"], note_es=note["es"],
                )


def unseed(apps, schema_editor):
    apps.get_model("finance", "FinanceRule").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("finance", "0004_financerule")]
    operations = [migrations.RunPython(seed, unseed)]
