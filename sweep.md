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

## Tur 2 — bulgular (deploy #488 sonrası, 2026-09-24 03:00–03:40)

Tarama: sitemap'teki 1.524 public URL (EN/IT/ES) curl ile; 4 dashboard'un tüm rotaları (staff 21, broker 9, seller 7, professional 7) tarayıcıda otomatik kontrol.

| # | Alan | Bulgu | Durum |
|---|------|-------|-------|
| W11 | Public | **Profesyonel dizini ve 320 profesyonel detay sayfası 500** — API `services_directory` kovası 60/dk/adres; bir sayfa 2–3 çağrı olduğu için tek adresten ~20 sayfa/dk sonrası hata sayfası (NAT arkasındaki ofis, tarayıcı botu). Listelerle aynı tavan (300/dk). | ✅ #490 |
| W12 | Public | Profesyonel sayfasında ekip rolü ham enum ("ADMIN"). | ✅ #491 |
| W13 | Seller/Broker/Professional | Notifications sayfasında iki "Notifications" h1 (sayfa başlığı + e-posta tercihleri bloğu). Blok artık "Email preferences" alt başlığı. | ✅ #490 |
| W14 | Media | Yüklenen fotoğraflar dev'de saatlerce SCANNING'de kalıyordu; kaybolan worker görevi için yeniden kuyruklama yoktu → 15 dk sonra yeniden kuyruklayan, 6 saat sonra nedenle reddeden bakım süpürmesi (#489). Health uç noktasına clamd kontrolü eklendi (#492) → dev'de `media_scanner: unavailable`: **clamd konteyneri erişilemiyor**. Sunucuda `docker compose restart clamav` (loglara bakıp). | ✅ #489 #492 / ⏳ dev'de clamav yeniden başlatma (kullanıcı) |
| W15 | Staff | Advertising sayfasında yerleşim adları BOAT_LIST/BOAT_DETAIL kodla görünüyor (seçenek etiketi var, tablo hücresi ham). | ✅ #493 |
| W16 | Public | Tekne sayfaları deploy sırasında ~1 dk 502 (Cloudflare → origin). Prod için sıfır kesintili deploy notu. | ℹ️ |
| W17 | Public | /sell/create/ sekme başlığı "My listings · Seller area", eyebrow "MARITIME BROKERAGE REGISTRY" — özel satıcı için yanlış ad. | ✅ #493 ("Sell your boat" / "Seller area / My listings") |
| W3 | Public | Featured kartlar hâlâ QA yer tutucu (W14'e bağlı). | ⏳ |

Temiz: staff 21 rota, broker 9, seller 7, professional 7 — kırık resim, ikon metni, `undefined/NaN`, çevrilmemiş anahtar, 404 iç bağlantı yok. Public 1.524 URL: W11 ve deploy penceresi dışında 200.

## Tur 3 — bulgular (deploy #496 sonrası, 2026-09-24 04:10–04:50)

Tarama: sitemap'teki 1.524 public URL curl ile (sıralı, 0,4 s ara); 4 dashboard'un tüm rotaları (staff 19, broker 9, seller 7, professional 7) tarayıcıda otomatik kontrol; #493/#494/#495 dönüşleri elle.

| # | Alan | Bulgu | Durum |
|---|------|-------|-------|
| W18 | Public/SEO | Sitemap altı kategori sayfasını `/services/<slug>/` olarak veriyor; bu adresler `/services/professionals/<slug>/`'a 301 atıyor. Tarayıcılara yönlendiren URL verilmez; kanonik yol listelenir. | ✅ #497 |
| W19 | Seller | Menü "Enquiries & messages", sayfa başlığı/sekme "Messages", broker menüsü "Messages" — tek ad: Messages. | ✅ #497 |
| W20 | Broker | /dashboard/broker/fleet/new/ sekme başlığı "Fleet", sayfa başlığı "Add a vessel". | ✅ #497 |
| W21 | Public | Sıralı taramada 248 profesyonel detay sayfası (l–z arası, üç dil) 500; aynı sayfalar hemen sonra tek tek 200. Sayfa başına 1 `services_directory` çağrısı (yerelde ölçüldü), tarama hızı ~85 sayfa/dk < 300/dk. Neden: durdurulan 6-paralel ilk tarama arka planda sürmüş, aynı adresten ~700 çağrı/dk. Tek başına sıralı sonda: 166 EN profesyonel sayfası, 0 hata. Tek ziyaretçi 300/dk tavanına yaklaşamaz. Not: API 429 verdiğinde public sayfa 500 hata sayfası gösteriyor; agresif bir tarayıcı için 429/503 sayfası daha doğru olur (ayrı iş). | ℹ️ (hata değil) |

Doğrulandı (dev): B2/B3/C2 (stripetest) — iki "Buy" tıklaması aynı Stripe oturumu; iptal dönüşü sipariş EXPIRED; promosyon iptali CANCELED + banner. S1: fiyat sayfası "Start a listing" → `/sell/create/?package=listing-2-weeks` ve form o paketi seçili açıyor. Staff Purchases artık "€9.99" / "€149" / "€99/month" (#496). Dev'de artık CHECKOUT_OPEN sipariş / PENDING promosyon kalmadı (yeni iptal uç noktalarıyla kapatıldı).

Temiz: staff 19 rota, broker 9, seller 7, professional 7 — kırık resim, ikon metni, `undefined/NaN`, çevrilmemiş anahtar, 404 iç bağlantı yok. Bekleyen: W3/W14 (clamav — kullanıcı).
