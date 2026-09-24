# Tam regresyon — 2026-09-24 (dev)

Kapsam: tüm public sayfalar (sitemap, EN/IT/ES), 4 dashboard (staff, broker, private seller, professional), Stripe akışları ve **18 e-posta şablonunun her biri için en az bir gerçek e-posta** (hedef kutu: hakantimur55@gmail.com).

## 1. Public sayfalar

| Alan | Sonuç |
|------|-------|
| Sitemap URL'leri (1.524, üç dil) | Hepsi 200. Deploy penceresine (#500/#501) denk gelen 10 adres ve kopan 1 istek yeniden kontrolde 200. |
| Sitemap içeriği | `/services/<slug>/` (301 atan) adresler yok; 519 servis adresinin hepsi kanonik `/services/professionals/...` (#497). |
| Ana sayfa reklam kartı | Görsel boştu → dev'deki 6 reklama tasarım görselleri yazıldı, seed komutu mutlak URL üretiyor (#500). |
| Ana sayfa featured şeridi | Fotoğrafsız QA ilanları yerine hazır fotoğraflı 4 demo ilan; `featured=1` en az bir READY fotoğraf ister; dev deploy `feature_demo_listings` çalıştırır (#501). |

## 2. Dashboard'lar (staff 19, broker 9, seller 7, professional 7 rota)

Otomatik kontrol (kırık resim, ikon metni, undefined/NaN, çevrilmemiş anahtar, 404 iç bağlantı, sekme başlığı = sayfa başlığı): **seller 7 (hakantimur55 ile), broker 9, professional 7 temiz**; **staff 19 (staff@ ile ve sonra hakantimur55 ile, STAFF rolü + staff_admin/staff_moderator grupları) temiz**, tek istisna R5 (#502 ile kapandı). Email templates sayfasındaki `{{ name }}, {{ url }}` metinleri şablon değişkenlerinin bilinçli listesi (bulgu değil).

Not: hakantimur55 hesabı STAFF rolüyle ama staff grubu olmadan tüm staff sayfalarında "Access denied" görüyordu (R3). Satıcı senaryoları için rol geçici olarak PRIVATE_SELLER yapıldı; regresyon sonunda hesap **STAFF + staff_admin + staff_moderator** olarak bırakıldı (e-postalar rolden bağımsız, ilan sahibi/alıcı e-postasına gider).

## 3. E-posta şablonları — senaryo planı

Yapıldı (Django admin, kullanıcı girişiyle): hakantimur55 → staff_admin + staff_moderator grupları; broker2@ → `hakantimur55+broker@gmail.com`, professional2@ → `hakantimur55+pro@gmail.com`, private1@ → `hakantimur55+seller@gmail.com` (doğrulama sıfırlandı). Aynı şifre.

| Şablon | Senaryo | Durum |
|--------|---------|-------|
| password_reset | /forgot-password → hakantimur55 | ✅ gönderildi (08:1x) |
| email_verification | +seller hesabında doğrulama sıfırlanıp "resend verification" | ✅ gönderildi (202) |
| new_message | private@ → hakantimur55'in onaylanan ilanına (Azimut 1 month) soru | ✅ gönderildi (inquiry.received) |
| listing_submission_received | hakantimur55 taslağı ("paid listing 2 weeks") gönderir | ⏳ gönderim en az bir READY fotoğraf ister (`media_ids required_for_submission`); fotoğraf taraması clamav'a bağlı |
| listing_approved / listing_changes_requested / listing_rejected | staff@ hakantimur55'in üç bekleyen Azimut ilanına karar verdi (1 month → onay, 2 months → değişiklik, 3 months → red) | ✅ üçü de bildirim kuyruğunda (08:20) |
| listing_expiring / listing_expired | `expires_at` admin'de salt okunurdu → #503 ile düzenlenebilir. Ayarlandı: Azimut Atlantis 34 (e66467bf) 25/09 12:00 UTC'de bitiyor → 1 günlük hatırlatma 25/09 03:15 UTC; ikinci onaylı ilan (449fcb26) 24/09 00:00 UTC'de bitmiş → 25/09 03:00 UTC'de EXPIRED + e-posta | ✅ ayarlandı, yarın sabah düşer |
| broker_trial_started | +broker (hakan broker / hakan-broker-2) "Start your 30-day free trial" → Stripe (kart: kullanıcı) | ✅ deneme 24/10/2026'ya kadar; bildirim broker.trial_started 09:21 UTC |
| professional_activated | +pro'nun üyeliği 10:05 UTC lapse görevinde düşünce Membership sayfasından yeniden aktivasyon checkout'u (kart: kullanıcı) | ⏳ lapse sonrası |
| payment_fulfilled | +seller üç paket satın aldı (1 hafta, 2 hafta, 1 hafta; siparişler 06c2c5e3, f4a4afcb, 351958b7) | ✅ 09:24:53 / 09:26:48 / 09:28:06 UTC |
| payment_fulfillment_failed | PaymentOrder admin salt okunur (§26.3) → checkout açıldıktan sonra ListingPackage slug'ı admin'de değiştirildi (`listing-2-weeks` → `listing-2-weeks-qa`); webhook Stripe metadata'daki paketi `order.package.slug` ile karşılaştırıp `package_mismatch` ile siparişi (d241def7, 14,99 €) Failed'a çekti ve staff_admin'e bildirdi; slug geri alındı | ✅ 09:35:35 UTC |
| professional_deactivated | +pro'nun aboneliği admin'den PAST_DUE + `past_due_since` = 2 gün önce → saatlik lapse görevi (:05) | ✅ ayarlandı, 10:05 UTC'deki çalıştırmada düşer |
| broker_suspended | BrokerSubscription admin'de yoktu → #503 ile eklendi; +broker'ın aboneliği (28b6469d) PAST_DUE + `past_due_since` 22/09 09:00 UTC → aynı saatlik lapse görevi | ✅ ayarlandı, 10:05 UTC'de düşer |
| broker_payment_failed / professional_payment_failed | Stripe webhook'ta `invoice.payment_failed` tanımlı değil (S6) → **tetiklenemez**, Stripe Dashboard'da olay eklenmeli | ❌ dış bağımlılık |
| contact_request_received | Sabit alıcı `CONTACT_NOTIFY_EMAIL` (info@nautelo.com) → kutunuza düşmez; env değişmeli | ❌ dış bağımlılık |

## 4. Bulgular

| # | Alan | Bulgu | Durum |
|---|------|-------|-------|
| R1 | Public | Demo reklamların görseli yok (seed göreli yol yazıyor, URLField reddediyor). | ✅ #500 |
| R2 | Public | Featured şeridinde fotoğrafsız ilanlar; dev'de şerit demo ilanlarla dolu tutulmuyor. | ✅ #501 |
| R3 | Staff | STAFF rolündeki hesap grup üyeliği olmadan her staff sayfasında "Access denied" görüyor; gruba yalnız Django admin'den alınabiliyor, staff Users ekranında rol/grup ataması yok. | ⏳ karar (ürün) |
| R5 | Staff | Advertising sayfasında yerleşim açılır listesi ham kod gösteriyor (HOME, BOAT_LIST, BOAT_DETAIL…); tablo hücresi #493 ile düzelmişti, seçenek etiketleri kalmış. | ✅ #502 |
| R6 | Broker | "My plan" sayfası Stripe'tan `?checkout=success` ile dönünce hiçbir onay mesajı göstermiyor (satıcı "My listings" sayfası gösteriyor); yalnız durum rozeti FREE TRIAL'a dönüyor. | ⏳ P3 |
| R4 | Seller | Kullanılmamış paketi olan satıcı fiyat sayfasından "Start a listing" ile gelince satın alma bloğu hiç görünmüyor (`?package=` boşa gidiyor); ikinci paket satın almanın UI'da yolu yok. | ⏳ |
