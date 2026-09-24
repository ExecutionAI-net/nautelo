# Stripe ve ücretli akışlar — ayrıntılı test planı ve sonuçlar (2026-09-24)

Ortam: dev.nautelo.com (Stripe test modu). Kart girişi kuralım gereği benim tarafımdan yapılmaz: Checkout sayfasına kadar ben getiririm, kartı (4242 4242 4242 4242, ileri tarihli son kullanma, herhangi CVC) kullanıcı girer; ödeme sonrası doğrulamayı ben yaparım (staff Purchases, entitlement defteri, ilan durumu, bildirim, e-posta).

Backend baseline: `payments`, `promotions`, `brokers/test_billing`, `professionals/test_billing` → 338 test yeşil (yerel).

## A. Ücretsiz ilan (private seller)

| # | Adım | Beklenen | Sonuç |
|---|------|----------|-------|
| A1 | private1@ (ücretsiz hak kullanılmamış) → /sell/create/ | 1 ücretsiz ilan hakkı; 1 fotoğraf limiti; "free listing" bilgisi formda | ✅ "Photos 0 / 1", "A free listing includes 1 photo and no video…" + paket seçici |
| A2 | Taslak kaydet → 2. fotoğraf eklemeye çalış | Limit mesajı, ödeme/upgrade önerisi | ✅ API 409 `media_limit_reached` (images_allowed 1); formda paket seçici |
| A3 | Submit → staff onayı → yayın | 30 gün yayın süresi, "Featured" yok | ⏳ dev'de fotoğraf SCANNING'de kalıyor (W14); READY olmadan submit edilemez |
| A4 | İkinci ücretsiz ilan denemesi | Engellenir; "next free listing on <tarih>" + paket satın alma | |

## B. Ücretli ilan paketi (Stripe Checkout, payment mode)

| # | Adım | Beklenen | Sonuç |
|---|------|----------|-------|
| B1 | /pricing/ → paket seç → Checkout | Doğru paket adı, tutar, para birimi (adaptive: TR'de TRY normal); success/cancel URL bizim domain | ⚠️ Tutar 9,99 € / 577,83 TRY doğru; **satır adı Stripe ürün adından geliyor: "Paid listing right 1week"** (Django'da adları düzelttim: "Paid listing - 1 week/2 weeks/1 month"; Stripe Sandbox'taki ürün adlarını da aynı yapmak gerekir — Stripe Dashboard'dan). /pricing/ "Start a listing" seçilen paketi taşımıyor (S1). |
| B2 | Checkout'u iptal et | "Checkout cancelled. Nothing was charged." ; Purchases'ta EXPIRED/CHECKOUT_OPEN kaydı | ✅ mesaj doğru; sipariş CHECKOUT_OPEN kalıyordu → #493 ile iptalde EXPIRED (dev'de doğrulandı: banner + sipariş EXPIRED, URL temizlendi) |
| B3 | Aynı paketi tekrar başlat | Aynı order tekrar kullanılır (replay), çift order yok | ❌→✅ İkinci tıklama yeni Stripe oturumu + ikinci CHECKOUT_OPEN order açıyordu; #493: açık oturum yeniden kullanılır (dev'de doğrulandı: iki tıklama aynı cs_test_… oturumu, yeni order yok) |
| B4 | Kart ile öde (kullanıcı) | Purchases FULFILLED, entitlement PAID_LISTING ACTIVE, bildirim "Your purchase is ready", e-posta | |
| B5 | Yeni ilan oluştur → paket uygula | 20 fotoğraf + 1 video limiti; publish süresi pakete göre | |
| B6 | Stripe'tan iade (staff, Stripe dashboard) | Order REFUNDED, entitlement iptal, ilan yayından iner mi? (spec) | |
| B7 | Webhook tekrar teslimi | İkinci entitlement yok (idempotent) | |

## C. Tanıtım (Promotion: 1 hafta / 2 hafta / 1 ay)

| # | Adım | Beklenen | Sonuç |
|---|------|----------|-------|
| C1 | Yayındaki ilan → Promote → plan seç | Checkout: "Featured listing - <plan> (n days)" tutar plana göre | ✅ "Featured listing - 2 weeks (14 days)" €149 / 8.618,27 TRY; checkout dili hesabın diline göre (EN) |
| C2 | İptal | Purchases'ta Canceled; ilan featured değil | ❌→✅ Dönüşte hiç mesaj yoktu, kayıt "Awaiting payment" kalıyordu, tekrar seçim ikinci oturum açıyordu → #494 (dev'de doğrulandı: banner + promosyon CANCELED) |
| C3 | Öde (kullanıcı) | Kart "Featured until <tarih>", ana sayfa featured şeridi, /boats/ sıralaması | |
| C4 | Extend | Süre uzar (bitişten itibaren) | ⚠️→✅ Diyalog "starts when your listing goes live" diyordu (ilan yayında ve 07/10'a kadar featured) → #494: "already featured until <tarih>; the new period continues from there" |
| C5 | Bekleyen (PENDING) ilan için promote | Ödeme alınır, yayına girince başlar | |
| C6 | Professional profil promote | "Featured profile", dizinde ilk sıra + rozet | |

## D. Broker aboneliği (subscription mode, deneme süresi)

| # | Adım | Beklenen | Sonuç |
|---|------|----------|-------|
| D1 | Yeni broker kaydı → profil → My plan → Start free trial | Checkout subscription, trial gün sayısı planla aynı, kart zorunlu | |
| D2 | Öde (kullanıcı) | Status TRIALING, "Your free trial runs until …", brokerage PENDING→staff onayı | ⚠️ broker@ kaydı ACTIVE / "Paid until 23/10/2026. Renews automatically" gösteriyor; Stripe tarafı: deneme 23 Ekim'de bitiyor ve **iptal planlanmış**. Kayıt #476 öncesi (23 Eyl 18:16) eski veri; kod artık deneme'yi doğru işliyor. Ancak bkz. S6. |
| D3 | Manage billing (portal) | Stripe portal açılır, iptal planlanabilir → "Cancellation scheduled" | ⚠️ Portal açılıyor (billing.stripe.com, Visa 4242, "23 Eki'de iptal edilecek"); bizim sayfa "Cancellation scheduled" göstermiyor çünkü `customer.subscription.updated` webhook'u hiç gelmemiş (S6) |
| D4 | İkinci deneme hakkı yok | Trial kullanılmış broker tekrar trial göremez | |
| D5 | Plan limitleri | 5 ilan / 2 koltuk aşımı → hata mesajı (plan_seat_limit_reached) | |

## E. Professional üyeliği (49 €/ay)

| # | Adım | Beklenen | Sonuç |
|---|------|----------|-------|
| E1 | Yeni professional → membership checkout | Trial / tutar doğru | ✅ plan 49 €/ay, 30 gün deneme, Stripe id dolu (kod: `_is_trial_checkout` ile deneme doğru işleniyor) |
| E2 | Öde → profil ACTIVE, dizinde görünür | Bildirim "Your professional profile is live" | ⚠️ professional@ sayfası "ACTIVE — Paid until 23/10/2026. Renews automatically each month." diyor; Stripe portalı "ücretsiz deneme 23 Ekim'de bitiyor" diyor. Kayıt #476 (deneme algılama düzeltmesi) öncesi veri; yeni kayıtlar doğru. |
| E3 | Portal → iptal | Dönem sonunda dizinden düşer | ⚠️ Portal açılıyor (billing.stripe.com); iptal bize S6 yüzünden yansımaz |

## F. Django admin / staff kontrolleri

| # | Kontrol | Sonuç |
|---|---------|-------|
| F1 | Products & pricing: Stripe fiyat eşleşmesi (price check) | ✅ Paketler/planlar stripe_price_id dolu; MarketplaceProduct'lar pasif (paketler satılıyor) — admin'de "INDIVIDUAL_LISTING_RIGHT (inactive)" görünümü kafa karıştırıcı ama zararsız |
| F2 | ListingPackage'lar aktif + Stripe id'leri dolu | ⚠️ 3 aktif paket (7/14/30 gün, 9.99/14.99/19.99 €) Stripe id'li; 3 pasif eski paket (0,00 €) admin listesinde duruyor. Aktiflerin adları tutarsızdı ("Paid listing right 1week") → admin'den düzelttim. |
| F3 | Promotion planları + fiyatlar | ✅ week 99 €/7 gün, two-weeks, month — aktif (fiyatlar iş kararı) |
| F4 | Broker planları: stripe_price_id, trial_days | ✅ 299/890/1850 €, 30 gün deneme, Stripe id'leri dolu; Professional 49 €/30 gün deneme |
| F5 | Webhook event kayıtları (tekrar/duplicate) | ✅ 12 olay, hepsi Fulfilled; duplicate yok |

## Bulgular

| # | Bulgu | Durum |
|---|-------|-------|
| S1 | /pricing/ "Start a listing" seçilen paketi /sell/create/'e taşımıyor; satıcı formda paketi yeniden seçiyor | ✅ #495 (`?package=` ile ön seçim) |
| S2 | Eligibility API ödenen paketin süresini değil platform varsayılanını (30 gün) bildiriyordu (1 haftalık paket için) | ✅ #491 |
| S3 | Stripe Checkout satır adı Stripe ürün adından geliyor ("Paid listing right 1week") | ⏳ Stripe Dashboard'da ürün adlarını düzeltmek gerekir (bende erişim yok) |
| S4 | İptal edilen checkout CHECKOUT_OPEN kalıyor, tekrar tıklama ikinci oturum açıyordu | ✅ #493 |
| S5 | /api/v1/health/ tarayıcıyı (clamd) raporlamıyordu; dev'de fotoğraflar saatlerdir SCANNING | ✅ #492 → deploy sonrası `media_scanner: "unavailable"`: **dev'de clamd erişilemiyor** (kök neden bulundu). Sunucuda: `docker compose ps clamav`, `docker compose logs --tail=50 clamav`, `docker compose restart clamav`; düzelince #489 süpürmesi takılı fotoğrafları 15 dk içinde işler. |
| S6 | **Stripe webhook uç noktası yalnızca `checkout.session.completed` ve `invoice.paid` alıyor** (12 kayıt, başka tür yok). `customer.subscription.updated/deleted`, `invoice.payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.*` gelmediği için iptal/başarısız ödeme/iade bize hiç yansımıyor (broker@ iptali görünmüyor). Stripe Dashboard → Webhooks → endpoint → event listesine bu türleri eklemek gerekir (bende erişim yok). | ⏳ Stripe Dashboard (kullanıcı) |
| S7 | Broker "My plan" ve professional "My plan" sayfalarındaki Promotion bölümü iptal dönüşünde mesaj vermiyor, bekleyen kaydı kapatmıyordu | ✅ #495 |
| S8 | Staff konsolunda dört ayrı para biçimi ("245,000 EUR", "9.99 EUR", "€299 / month", "0.00 EUR") | ✅ #496 (`display_money`: €245,000 / €9.99 / €99/month) |

