# Tam tarama — 2026-09-24 (public + staff + broker + professional + private seller)

Yöntem: her sayfada otomatik kontrol (kırık resim, metin olarak görünen ikon, `undefined/NaN/[object Object]`, ham enum, çevrilmemiş anahtar, `role=alert`, iç bağlantı 404/500, konsol hatası) + göz kontrolü. Hesaplar: staff@, broker@, private@, professional@ (nautelo.com). Tekrar tekrar gezilecek; her turda tablo güncellenir.

## Tur 1 — bulgular

| # | Alan | Bulgu | Durum |
|---|------|-------|-------|
| W1 | Public | **Her tekne sayfası (`/boats/<slug>/`) ve ilan önizleme sayfası 500** — dünkü #476 "compare" özelliği sunucu bileşeninden istemci bileşenine fonksiyon geçiriyordu. Ana sayfa ve liste sayfasındaki tüm tekne bağlantıları kırıktı. | ✅ #486 (deploy edildi, doğrulandı) |
| W2 | Staff | **Boats sayfası "This page couldn't load"** — aynı sınıf hata (`publicLink.when` fonksiyonu). | ✅ #487 |
| W3 | Public | Ana sayfadaki "Featured boats" kartlarında resim yok gibi görünüyor: iki ilan QA testlerinde yüklenen yer tutucu görsel (mavi zemin, "QA photo 1"). Resim dosyası sağlam, içeriği yer tutucu. | ⏳ gerçek fotoğrafla değiştirilecek |
| W4 | Staff | Tablo başlıklarındaki sıralama ikonu "UNFOLD_MORE" olarak yazı görünüyor: ikon fontu alt kümesinde 7 ikon eksikti (arrow_upward, unfold_more, block, confirmation_number, mark_email_unread, storefront, workspace_premium). | ✅ #484 + #485 (liste testle korunuyor) |
| W5 | Staff | Entitlement ledger'da ham enum: PAID_LISTING, STRIPE_PURCHASE, FREE_LISTING, FREE_POLICY. | ✅ bu PR |
| W6 | Seller | Sayfa adları menüyle uyuşmuyor: "OWNER PORTAL / Welcome back, X" (menü: Overview), "BESPOKE MARITIME PORTFOLIO / My vessel listings" (My listings), "YOUR MESSAGES / Messages" (Enquiries & messages), "SERVICES / Nautical concierge & services" (Services), "YOUR ACCOUNT / Account" (My account); Notifications sayfasında başlık yok. | ✅ bu PR |
| W7 | Professional | "SERVICE PROVIDER DESK / <firma adı>" (Dashboard), "SERVICE REQUESTS / Messages" (Requests), "SERVICE CATALOGUE / Your services" (Services), "Company profile — Status: ACTIVE" (Profile, ham enum), "Team, roles and permissions" + ADMIN/MANAGER seçici + "Profile - Team - Messages"; Notifications başlıksız. | ✅ bu PR |
| W8 | Broker | Batch A (#483) canlıda doğrulandı: Dashboard/Fleet/Edit vessel (financing bölümü geri geldi)/Leads/Messages/Team/Profile/My plan/Notifications. | ✅ |
| W9 | Public | 44 public rota (EN/IT/ES dahil) 200; `/boats/<slug>/` W1 ile düzeldi. Kırık resim, ham enum, çevrilmemiş anahtar yok. | ✅ |
| W10 | Lighthouse | Ana sayfa (mobil, CLI): sunucu yanıtı 887 ms → 240 ms; render-blocking yok; görsel/önbellek uyarıları kapandı; ikon fontu 168 KB → 16 KB (#485). Kalan: LCP 4.6 s mobil simülasyonda (JS 170 KB + fontlar). | ✅ / devam |

## Tur 2 — (deploy sonrası yeniden gezilecek)

- [ ] Tüm rotalar tekrar (public + 4 dashboard), aynı otomatik kontrol.
- [ ] Featured kartlar gerçek fotoğrafla.
- [ ] Stripe akışları (stripetest.md).
