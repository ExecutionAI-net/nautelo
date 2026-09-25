"""The shared header/hero/footer chrome every transactional email renders
inside. Kept as one function, not a template file, so there is exactly one
place that defines "what a Nautelo email looks like" - a staff-authored
template's `html_body` is only ever the content between the hero and the
footer.

The header uses the real brand logo (frontend/public/brand/logo-horizontal.png
- a PNG, not the .svg sibling, because inline/remote SVG has poor support in
Outlook and other email clients; the PNG is a Stitch-rendered flat export of
the same artwork). It is referenced by absolute URL built from
PUBLIC_BASE_URL, the same settings constant every other outbound link (the
verify-email/reset-password URLs) already uses, since Next.js serves
frontend/public/* at that origin. The hero band below it stays typography and
a CSS gradient against the product's own brand tokens (tailwind.config.ts) -
no yacht photo asset exists yet to put there.
"""

from django.conf import settings

BRAND_NAVY = "#001520"
BRAND_TEAL = "#00696e"
BRAND_SURFACE = "#fbf9f4"
BRAND_GOLD = "#a78a54"

SUPPORT_EMAIL = "support@nautelo.com"


def wrap_in_layout(inner_html: str) -> str:
    logo_url = f"{settings.PUBLIC_BASE_URL}/brand/logo-horizontal.png"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nautelo</title>
</head>
<body style="margin:0;padding:0;background:{BRAND_SURFACE};font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BRAND_SURFACE};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">

<tr><td style="padding:24px 32px;" align="center">
<img src="{logo_url}" alt="Nautelo" width="280" style="display:block;max-width:280px;width:100%;height:auto;">
</td></tr>

<tr><td style="background:linear-gradient(135deg,{BRAND_NAVY},{BRAND_TEAL});padding:36px 32px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.3;color:#ffffff;">Explore.<br>Connect.<br>Set Sail.</div>
<div style="margin-top:12px;width:48px;height:3px;background:{BRAND_GOLD};"></div>
</td></tr>

<tr><td style="padding:32px;font-size:15px;line-height:1.6;color:{BRAND_NAVY};">
{inner_html}
</td></tr>

<tr><td style="padding:20px 32px;background:{BRAND_SURFACE};font-size:12px;color:#5f6b6c;">
<p style="margin:0 0 4px;">Need help? Contact us at <a href="mailto:{SUPPORT_EMAIL}" style="color:{BRAND_TEAL};">{SUPPORT_EMAIL}</a></p>
<p style="margin:0;">&copy; Nautelo &mdash; Yachts. Services. Together.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""
