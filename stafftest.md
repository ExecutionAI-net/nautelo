# Staff paneli kullanılabilirlik testi — 2026-09-24

Hesap: staff@nautelo.com (dev.nautelo.com). Kapsam: `/dashboard/staff/*` altındaki tüm sayfalar, sol menü, bildirim zili, tablolar (arama, filtre, sayfalama, detay paneli), moderasyon kuyruğu ve inceleme ekranı, abonelikler, satın almalar, entitlement defteri, contact grants, taksonomi, reklam, içerik, e-posta şablonları, raporlar, ayarlar, iletişim talepleri.

Öncelik: **P1** kafa karıştırıyor / iş yaptırmıyor · **P2** verimsiz · **P3** cila.

## 1. Sol menü ve genel çerçeve

| # | Ö | Bulgu | Öneri |
|---|---|-------|-------|
| S1 | P1 | Menü öğeleri sol kenara yapışık (16px), grup başlığı ile alt öğeler arasında hiyerarşi zayıf; "Home" kocaman siyah bir buton olarak menünün tepesinde, zil ve daralt ikonu arasında sıkışmış. | Menüye iç boşluk; "Home"u küçük bir "Nautelo'ya dön" bağlantısına çevirip menünün altına (kullanıcı adı / çıkış yanına) al; tepede yalnız daralt + zil kalsın. |
| S2 | P1 | Dashboard'un adı "Moderation": menüde "Moderation" grubunun içinde yine "Moderation" öğesi; sayfa başlığı "Nautelo Staff Dashboard", üst etiket "Staff administration / Marketplace moderation", sekme başlığı "Moderation · Staff area". Dört farklı ad. | Menü öğesi "Dashboard", grup "Overview"; sayfa başlığı "Staff dashboard"; üst etiket "Staff / Dashboard". |
| S3 | P1 | Yeni "Contact requests" sayfası menüde yok (yalnız adresle ulaşılıyor). | Sales grubuna ekle. |
| S4 | P1 | Zil menüsü sol kenardan taşıyor, metin kesik ("me about these", "ications"). | Açılır kutuyu zilin soluna değil sağına hizala. |
| S5 | P1 | Bildirim WebSocket'i dev'de sürekli düşüyor (`wss://dev.nautelo.com/ws/notifications/` failed, 401), birkaç dakikada 117 konsol hatası. | Sunucu tarafı WS proxy/kimlik doğrulama kontrolü; istemcide üst üste başarısızlıkta yeniden bağlanmayı seyrelt. |
| S6 | P2 | Menüde olmayan sayfalarda sekme başlığı düşüyor: inceleme ekranı "Moderation · Staff area", iletişim talepleri "Staff area". | Sayfa başlığını (h1) sekme başlığına yansıt. |
| S7 | P2 | Dil seçici (EN/IT/ES) staff menüsünde; staff ekranları İngilizce olduğu için yalnız menü etiketleri değişiyor, gerisi karışık dil. | Staff alanında dil seçiciyi gizle (hesap dili profil ayarından değişir). |
| S8 | P2 | Dashboard'daki "Staff Management Modules" kartları menüyü tekrarlıyor ama adlar farklı: kartta "Requests" / menüde "Service requests", kartta "Guides" / menüde "Content"; "Subscriptions" kartının açıklaması "Listing rights and entitlements" (bu Entitlements sayfasının işi). | Kart adları ve açıklamaları menüyle bire bir aynı olsun; Contact requests ve Purchases kartı eklensin. |
| S9 | P2 | Dashboard'da "Dashboard Settings" butonu aslında platform ayarlarına gidiyor. | "Platform settings". |
| S10 | P2 | Üst etiketler tutarsız: "STAFF ADMIN / LISTINGS", "STAFF MODERATION / MESSAGING", "COMMERCIAL MEDIA NETWORK - SPONSORSHIP DESK", "EDITORIAL WORKSPACE", "STAFF ADMINISTRATION / MARKETPLACE MODERATION". | Hepsi "Staff / <menü adı>". |
| S11 | P2 | Sayfa başlıkları pazarlama dili: "Subscription Tiers & Billing Oversight", "Editorial CMS & Knowledge Base", "Advertisements & Brand Sponsorship", "Marketplace Analytics", "Platform Configuration", "User Management" — menüde ise "Subscriptions", "Content", "Advertising", "Reports", "Settings", "Users". | Başlık = menü adı; açıklama cümlesi kalsın. |

## 2. Liste tabloları (Boats, Users, Brokers, Providers, Leads, Service requests, Subscriptions, Purchases, Contact grants)

| # | Ö | Bulgu | Öneri |
|---|---|-------|-------|
| S12 | P1 | Hiçbir tabloda sütuna göre sıralama yok; kayıt tarihi gibi sütunlar da eksik (Brokers, Providers, Boats'ta tarih hiç yok). | Sunucu tarafı `ordering` parametresi + tıklanabilir sütun başlıkları; her tabloya "Created/Updated" sütunu. |
| S13 | P1 | Ham enum değerleri her yerde: PENDING_APPROVAL, PRIVATE_SELLER, BROKER_INQUIRY, LISTING_INQUIRY, STRIPE_PURCHASE, FREE_POLICY, CHECKOUT_OPEN, PAST_DUE… | Etiketleri insan diline çevir ("Pending approval", "Private seller"); filtre çiplerinde de aynı. |
| S14 | P2 | Tarihler ISO ("2026-09-23"), saat yok. | Yerel tarih, detay panelinde tarih+saat. |
| S15 | P2 | Users: "Active — Yes/No" sütunu ile durum filtresi (Active / Unverified / Suspended) uyuşmuyor; doğrulanmamış hesap "Yes" görünüyor. | Tek bir "Status" rozeti: Active / Unverified / Suspended. |
| S16 | P1 | Users ve Brokers/Providers detay panelinde "Suspend" / "Activate" onaysız, tek tıkla çalışıyor. | Onay penceresi + sonuç mesajı. |
| S17 | P2 | Detay paneli geniş ekranda sağda açılıyor; dar ekranda tablonun altına düşüyor ve görünmüyor (tıklama "çalışmıyor" hissi). | Panel açılınca görünür alana kaydır; ya da kayan (drawer) panel. |
| S18 | P2 | Arama kutusunun yer tutucusu sadece "Search"; neyi aradığı belirsiz. | "Search by name or email" gibi sayfaya özel yer tutucu. |
| S19 | P2 | Boats: "Owner" ve "Broker" iki ayrı sütun, biri hep "-". Yayındaki ilana açılan bağlantı yok. | Tek "Seller" sütunu; panelde "Open public page" bağlantısı. |
| S20 | P3 | Fiyat biçimi tutarsız: Boats "245,000 EUR", Subscriptions "€299 / month", Purchases "9.99 EUR". | Her yerde "€245,000". |
| S21 | P3 | Filtre çipleri sıfır sayılı seçenekleri de gösteriyor (DRAFT, PENDING…); çok kalabalık (Purchases'ta 14 durum çipi). | Sıfır olanları soluk göster ya da gizle. |

## 3. Sayfa özel bulgular

| # | Ö | Bulgu | Öneri |
|---|---|-------|-------|
| S22 | P1 | **Users / roller:** PRIVATE_SELLER, BROKER, PROFESSIONAL, STAFF ne demek, hangi yetkileri var, hiçbir yerde anlatılmıyor. "Admin / Staff (4)" ile "Staff" farkı belirsiz. | Users sayfasına rol açıklama kutusu (her rol için kısa tanım + yetkiler); detay panelinde rolün açıklaması. |
| S23 | P1 | **Subscriptions:** 160 satırda plan seçicisi + tarih girişi + pasif "Save renewal"; plan seçilince sessizce anında kaydediyor (onay yok, geri alma yok); tarih alanı tarayıcı diline göre "gg.aa.yyyy"; ücret "-". "Corporate Licensing Tiers" jargonu. | Plan değişikliğinde onay; tarih/renewal kontrolleri yalnız planı olan satırda; planı olmayan satırda "Assign plan" butonu; başlık "Broker plans". |
| S24 | P2 | **Purchases:** 10 sütun, Stripe id'leri (cs_test_…, pi_…) tabloyu yatay kaydırıyor. | Id'leri detay paneline taşı; tabloda kind/product/amount/status/date. |
| S25 | P1 | **Entitlements:** filtre ve grant formu "USER ID" (UUID) istiyor; kimse kullanıcı id'sini bilmiyor. | E-posta ile arama/seçim. |
| S26 | P1 | **Revision review:** "Length (m)" satırı iki kez (loa_m ve length_m); fiyat "753500" biçimsiz; ilan önizleme ve satıcıya bağlantı yok; kuyruğa "geri" bağlantısı yok. | Etiketleri ayır ("Length overall (m)" / "Hull length (m)"), fiyatı para biçiminde göster, "Back to queue" + "Preview listing". |
| S27 | P2 | **Dashboard / kuyruk:** kuyruk sayfanın en altında, kart sayaçları ve sekme butonları aynı sayıları iki kez gösteriyor; "Other-model queue · Entitlement ledger" bağlantıları açıklamasız. | Kuyruğu üste al, sayaçları tek yerde göster. |
| S28 | P2 | **Taxonomy:** "Other-model queue: No listings use the Other model" kutusu sayfa başlığının üstünde; 207 markalık `<select>`. | Kutuyu başlığın altına; marka aramayı seçici yerine liste filtresi yap. |
| S29 | P2 | **Settings / Products & pricing:** "INDIVIDUAL_LISTING_RIGHT · 0.00 EUR", "Price check: UNCHECKED"; asıl satılan paketler (1 hafta / 2 hafta / 1 ay) burada yok, sadece Django admin'de. | Paketleri burada (en azından salt okunur + admin bağlantısı) göster; ürün adlarını okunur yap. |
| S30 | P2 | **Content:** yazar "Nauta editorial team" (eski marka). | Veri düzeltmesi: "Nautelo editorial team". |
| S31 | P3 | **Advertising:** işlem düğmeleri yalnız ikon (pause/visibility/delete), etiket yok; "Always on" uçuş süresi. | Erişilebilir etiket + tooltip. |
| S32 | P2 | **Reports:** "Entitlements 81 — 162 brokers · 167 service providers" kartı ilgisiz sayıları karıştırıyor; "415 joined in the last 30 days" seed verisiyle anlamsız. | Kartı "Directory: brokers / providers" olarak ayır. |
| S33 | P2 | **Leads / Service requests:** görüşmeyi açacak bağlantı yok; konu satırının altında ham tür (BROKER_INQUIRY). | Tür etiketi okunur; panelde "Open conversation". |
| S34 | P3 | **Contact grants:** yalnız UUID (tasarım gereği) — staff için pratikte kullanılamaz. | Karar sende: en azından viewer e-postası + hedef adı. |
| S35 | P3 | **Email templates:** "Send test to myself" artık sonucu gösteriyor (önceki düzeltme); şablon değişkenleri listeleniyor. Sorun yok. | — |

## 4. Yapılanlar

Aşağıdaki tablo düzeltmeler ilerledikçe güncellenir.

| # | Durum | Not |
|---|-------|-----|
| S1, S2, S3, S4, S6, S7, S8, S9, S10, S11 | ✅ | Batch A: menü/ad birliği, Contact requests menüde, zil menüsü, sekme başlığı, dil seçici gizli |
| S12, S13, S14, S15, S16, S17, S18, S19, S21 | ✅ | Batch B: sıralanabilir sütunlar (`?ordering=`), okunur etiketler, tarih biçimi, tek durum rozeti, onay penceresi, panel kaydırma, arama ipuçları, sıfır çipler soluk |
| S22 | ✅ | Users sayfasında "What the roles mean" açıklaması |
| S23 | ✅ | Plan değişikliğinde onay; yenileme kontrolleri yalnız planı olan satırda; "Broker plans" |
| S24 | ✅ | Stripe id'leri detay paneline taşındı |
| S25 | ✅ | Entitlement defteri e-posta ile filtreler ve e-posta ile hak tanır |
| S26 | ✅ (kısmen) | "Length overall / Hull length", fiyat biçimli; "Back to queue" zaten vardı; önizleme bağlantısı yok |
| S28 | ✅ | Taksonomi: başlık önce, Other-model kuyruğu altta |
| S32 | ✅ | Reports: "Directory" kartı (broker + provider) |
| S5 | ✅ (istemci) | Sunucu tarafı sağlam (el sıkışma 101, geçerli token ile `auth_ok`). Hata kaynağı istemci: süresi dolmuş access token ile tekrar tekrar bağlanıyordu ve sayfa geçişinde bağlanmakta olan soket kapatılıyordu. Artık 4401'de önce token yenileniyor, bekleme 5 dk'ya kadar uzuyor, bağlanan soket açılınca kapatılıyor |
| S27 | ✅ | Kuyruk kısayol kartlarının üstünde; tekrar eden sayaç kartları kaldırıldı, açıklama eklendi |
| S29 | ✅ | Products & pricing'de satılan paketler listeleniyor (+ Django admin bağlantısı); ürün adları okunur |
| S30 | ✅ | Veri migrasyonu: "Nautelo editorial team" |
| S31 | — | Düğmelerde aria-label/title zaten var; değişiklik yok |
| S33 | ⏳ | Staff için görüşme görüntüleme ekranı yok; ayrı iş |
| S34 | ⏳ | Karar bekliyor (spec: yalnız id) |
| S20 | ✅ | #496 — `display_money`: €245,000 / €9.99 / €99/month |

