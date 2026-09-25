# Nautelo dev ortamı – uçtan uca regresyon testi (23 Eylül 2026)

Ortam: `https://dev.nautelo.com` (branch `dev`, deploy run #470 sonrası). Tüm kayıtlar demo.
Test hesapları: `staff@`, `private@`, `broker@`, `professional@nautelo.com`.
Yöntem: Claude'un yerleşik tarayıcısı ile UI turu + doğrudan REST API çağrıları + Django admin (`/admin/`) + Stripe sandbox (test kartı 4242) + yerel `pytest` / `vitest`.

## 1. Özet

| Alan | Sonuç |
|---|---|
| Rol bazlı giriş / oturum / yetki | ✅ 4 rol de çalışıyor, `/session/` izinleri role uygun, 403 sayfası doğru |
| Private seller: ilan oluştur → foto → incelemeye gönder → onay → yayın | ✅ uçtan uca çalışıyor |
| Private seller: ücretli ilan hakkı satın alma (€9.99, Stripe) | ✅ PaymentOrder FULFILLED, entitlement oluştu |
| İlan promosyonu (€149, Stripe) | ✅ webhook → PAID → yayında aktif (featured_until 07.10.2026) |
| Staff moderasyon: onay, revizyon onayı, kuyruk sekmeleri | ✅ çalışıyor |
| Yayınlanmış ilanı düzenleme (revizyon) | ⚠️ backend çalışıyor, **UI boş form açıyor (F19)** |
| Broker: abonelik deneme başlatma (Stripe) | ⚠️ Stripe tarafı doğru, **DB'de deneme ACTIVE olarak kaydediliyor (F13)** |
| Broker: abonelik iptali (Stripe portal) | ⚠️ Stripe'ta iptal edildi, **uygulama yansıtmıyor (F14)** |
| Professional: üyelik deneme (Stripe) → profil canlıya geçiş | ⚠️ profil ACTIVE oldu ve dizinde listelendi, **aynı F13 hatası** |
| Mesajlaşma: ilan/broker/profesyonel sorgusu, cevap, okundu | ✅ |
| İletişim bilgisi maskeleme → mesaj sonrası açılma | ✅ |
| Broker ekip daveti, finans tahmini kartı | ✅ |
| Değerleme, anlamsal arama, iletişim formu, rehberler, fiyatlandırma | ✅ |
| Karşılaştırma sayfası `/boats/compare/` | ❌ **sabit demo verisi (F17)** |
| i18n (IT) | ⚠️ çalışıyor, ama enum/başlık/sidebar çevirileri eksik (F18) |
| Yerel test paketleri | ✅ backend 2644/2644, frontend 666/666 |

Toplam: **20 bulgu (F)**, **18 kullanılabilirlik notu (U)**. Öncelikli olanlar: F13, F14, F19, F17, F7, F15.

## 2. Yapamadıklarım / kapsam dışı

- EC2'de `manage.py` komutu çalıştıramadım (yerelde AWS CLI / SSM erişimi yok). Django tarafı doğrulaması API + `/admin/` + yerel pytest ile yapıldı.
- Yerleşik tarayıcının dosya yükleme aracı yok; fotoğraflar UI dosya seçicisi yerine aynı API akışıyla (`media/intents/` → imzalı S3 PUT → `complete/` → tarama → READY) yüklendi. UI'daki sürükle-bırak/sıralama düğmeleri denenmedi.
- Yeni hesap kaydı (`/register/`) ve "şifremi unuttum" akışının e-posta adımı çalıştırılmadı (sayfalar yüklendi, form doğrulaması görüldü). E-posta teslimatı (ZeptoMail) gözlemlenemedi.
- Stripe'ta gerçek iade / ödeme başarısızlığı (4000 0000 0000 0341 gibi kartlar) denenmedi.

## 3. Oluşan test verisi (temizlenmedi)

| Kayıt | Kimlik |
|---|---|
| Private seller ilanı (PUBLISHED, featured) | `4bcbee52-ff3e-40ef-bac5-a33264b3841f`, slug `fairline-targa-34-2015-4bcbee52`, fiyat 185.000 (revizyon 2 onaylı) |
| Broker ilanı (PUBLISHED, finans kartı açık) | `3b392c32-770d-4c82-bd04-0f3ad099b0fd`, slug `fairline-targa-34-2015-3b392c32` |
| Promosyon (2 hafta, €149, PAID) | Stripe evt `evt_1UIt6bIiPQiDktz7cGsDGRDG` |
| Ücretli ilan hakkı (1 hafta, €9.99, FULFILLED) | order `3cfa78f0-143e-45a7-9941-098f4668fffc`, entitlement `250e1575-…` |
| Broker aboneliği (Stripe: trial, 23.10'da iptal) | `sub_1UIuiUIiPQiDktz7y9zNkgWX` |
| Professional üyeliği (Stripe: trial, aktif) | `professional-hakan-org` profili ACTIVE |
| Konuşmalar | private seller ilanına 1 sorgu, broker profiline 1 sorgu, broker'dan 1 cevap |
| Broker ekip daveti (bekliyor) | `qa-invite-20260923@nautelo.test` (AGENT, 30.09'da dolar) |
| İletişim formu kaydı | `qa-contact@nautelo.test` |

## 4. Bulgular (hata / spesifikasyon)

### Yüksek

- **F13 – Deneme aboneliği ACTIVE olarak kaydediliyor (broker + professional).**
  Stripe tarafında 30 günlük ücretsiz deneme doğru oluştu (€0 fatura, "deneme 23 Ekim'de bitiyor"). Ancak `BrokerSubscription` / `ProfessionalSubscription` kaydı `status=ACTIVE`, `trial_ends_at=null`, `trial_used_at=null`. Sonuç: API `trial_available=true` döner (deneme tekrar alınabilir), UI "ACTIVE – Paid until 23/10/2026. Renews automatically" gösterir.
  Muhtemel neden: `checkout.session.completed` ve `invoice.paid` webhook'ları aynı saniyede işlendi (`evt_1UIuiVIiPQiDktz731RpWJbm`, `evt_1UIuiVIiPQiDktz7tGeOj3Mo`). `brokers/billing.py::_activate()` (ve `professionals/billing.py:123`) tam `subscription.save()` yaparak `_start_trial()`'ın yazdığı TRIALING/trial_* alanlarını eski instance ile eziyor. Ayrıca `handle_invoice_paid` 0 tutarlı faturada bile status TRIALING değilse `_activate` çağırıyor.
  Öneri: webhook işlemeyi abonelik satırı üzerinde `select_for_update` ile seri hale getirmek, `_activate`'te `update_fields` kullanmak, `amount_paid == 0` ve `trial` metadata'sı varsa aktivasyon yerine deneme başlatmak.

- **F19 – Yayınlanmış ilanın "Edit listing" sayfası boş form açıyor.**
  `/listings/<id>/workflow/` yayın sonrası `revision: null` döner; `SellListingForm.tsx:92` yalnızca `initial.revision.payload`'dan besleniyor, snapshot'tan değil. Satıcı canlı ilanını UI'dan düzenleyemiyor. Backend sağlam: `PATCH /draft/` yayınlı ilanda snapshot'tan klonlanmış revizyon 2 oluşturdu; sonrasında form doldu, gönderim ve staff onayı (fiyat 189k→185k, snapshot v2) çalıştı.

- **F17 – `/boats/compare/` sabit mock.** Sanlorenzo SX88 / Arcadia Sherpa 80 / Princess Y85, "Legal registry verified via Nautelo API", uydurma KDV/beam-ratio verileri. Gerçek ilanlara bağlı değil; spesifikasyon §31/§39 demo veriyi yasaklıyor.

### Orta

- **F14 – `customer.subscription.updated` işlenmiyor.** Portaldan "dönem sonunda iptal" yapıldıktan sonra uygulama hâlâ "Renews automatically" diyor; `cancel_at_period_end` bilgisi yok. Kullanıcı iptalinin alındığını 23 Ekim'e kadar göremiyor.
- **F15 – Stripe adaptive pricing açık.** Broker aboneliği portalda "TRY cinsinden ücretlendirildi" görünüyor; checkout EUR→TRY geçişi sundu. Abonelik ve tek seferlik ödemelerin yabancı para biriminde tahsil edilmesi muhtemelen istenmiyor; Stripe dashboard ayarını gözden geçirin.
- **F7 – Promosyon "ödendi" durumu URL'den okunuyor.** `SellListingForm.tsx:149` `?promotion=success` parametresine güveniyor; "Promotion paid" bandı ve promosyon diyaloğunun atlanması sunucudan doğrulanmıyor (webhook yine de asıl kaynak, ama UI yanıltıcı).
- **F18 – i18n boşlukları.** IT/ES'de tekne tipi (Motor yacht…), yakıt (Diesel, Petrol…) ve sayfa `<title>`'ları (Create an account, Reset your password) İngilizce; dashboard sidebar (Portfolio, Communication, Account, Sign out), paket adları, "Package/Quantity", değerleme sonucu metni de çevrilmemiş.
- **F12 – Staff "Purchases" sayfası eksik.** "Every marketplace order" der ama `ListingPromotion` (€149) ve broker/profesyonel abonelikleri listelenmiyor; yalnızca Django admin'de görülüyor.
- **F10 – Revizyon inceleme ekranı moderatör için okunaksız.** `brand_id`/`model_id` ham UUID, `specifications` ham JSON, "Media: +1" ama fotoğraf küçük resmi yok. Moderatör neyi onayladığını göremiyor.

### Düşük

- **F1 / marka artıkları "Nauta".** Ana sayfa + `/financing/` ("Nauta does not lend money"), `/sell/` hero, `/valuation/` (2x), `/guides/` ("Nauta editorial team"), `/contact/` (başlık, KVKK onay metni), `/pricing/` + üyelik sayfası ("NAUTA directory"), promosyon diyaloğu IT ("home di Nauta"). `/contact/` sayfasında `@nauta-maritime.example.com` e-postalar ve sahte telefonlar var.
- **F3** – Her tam sayfa yüklemesinde konsola "401" hataları düşüyor (token yokken önce istek atılıp sonra refresh yapılıyor). Tasarım gereği ama gürültülü; refresh cookie varsa önce refresh yapılabilir.
- **F4** – `/dashboard/private-seller/services/` kategori ikonları kaymış (Full brokerage=engineering, Legal=local_shipping, Insurance=gavel, Engines=shield, Transport=sailing, Marketing=handyman).
- **F5** – Satış formunda marka seçildikten sonra combobox "Current brand" yazısını gösteriyor (marka adı yerine); kaydettikten sonra da böyle.
- **F6** – "Submit for review" fotoğraf READY olana kadar pasif, ama nedeni ekranda yazmıyor.
- **F8** – Gönderim sonrası `/sell/<id>/` sayfası sadece "Your listing was submitted for review." gösteriyor; ilanlarım linki / sonraki adım yok.
- **F11** – Entitlement ledger ve contact-grants yalnızca UUID gösteriyor (e-posta/ad yok); staff Boats tablosunda ilan başlığı yok, fiyat "189000.00" biçimsiz.
- **F16** – Herkese açık ilan API'si her medya için `storage_key` ve `checksum_sha256` döndürüyor (dahili S3 anahtarı sızıyor; sahip serializer'ı bunu bilerek gizliyor).
- **F20** – Revizyon düzenlemede kilitli marka/model/yıl combobox'ları "Seleziona…" (boş) görünüyor; mevcut kilitli değer gösterilmeli.
- **F2** – Broker'a giden `inquiry.received` bildiriminin `target_url`'i `/dashboard/private-seller/messages/<id>/` (genel rota, broker ekranı da bunu kullanıyor; çalışıyor ama rol bazlı rota olmalı).

## 5. Kullanılabilirlik notları (user gözüyle)

- **U1** Satış formu canlı önizlemede fiyat "€ 189000" biçimsiz; pazar yeri "€189,000" gösteriyor.
- **U2** Girişten sonra kullanıcı ana sayfaya düşüyor, kendi paneline değil.
- **U3** Tüm dashboard sayfalarının `<title>`'ı "Nautelo"; sekmeler ayırt edilemiyor.
- **U4** Satış formu inputlarının erişilebilir adı yok (label bağlı değil); kabin/banyo seçeneklerinin adı boş. Klavye/ekran okuyucu ile zor.
- **U5** Stripe Checkout Türkçe açıldı ve TRY seçeneği sundu (F15 ile ilgili).
- **U6** Promosyon ödemesi sonrası taslağa dönülüyor ve ilan hâlâ gönderilmemiş; "Submit" basılması gerektiği gözden kaçabilir.
- **U7** Sidebar'daki "Notifications" sayfası yalnızca e-posta tercihleri; uygulama içi bildirim listesi sadece zil menüsünde.
- **U8** Moderasyon kuyruğunda 60–96 gündür bekleyen seed gönderimleri var; demo için gürültü.
- **U9** "İlanlarım" kartı "2015 QA Test 2015 Fairline…" (yıl başlığa ikinci kez ekleniyor). Zaten öne çıkarılmış ilanda "Promote this boat" ve yeniden gönderimde promosyon upsell diyaloğu tekrar çıkıyor (çifte satın alma riski).
- **U10** Abonelik checkout'unda e-posta önceden doldurulmuyor (promosyon checkout'unda dolduruluyor).
- **U11** Broker mesaj detay sayfası "OWNER CONSOLE" başlığı taşıyor (liste sayfası "BROKERAGE CRM").
- **U12** `/dashboard/broker/leads/` "Nothing here yet" derken `/dashboard/broker/messages/` aynı broker'ın açık konuşmasını gösteriyor.
- **U13** Sorgu başarı mesajı "Your message has been forwarded to 2015 Fairline Targa 34" (tekneye hitap ediyor).
- **U14** Sorgu formunda görünür "Company website" alanı (honeypot?) gerçek kullanıcıyı şaşırtır.
- **U15** `/boats/` filtre çipleri URL'den gelince ham değer gösteriyor ("motor_yacht", "From €100000").
- **U16** Profesyonel "Requests" sayfası "OWNER CONSOLE" başlıklı ve ilan odaklı metin; servis tablosunda kategori slug'ı ("full-brokerage").
- **U17** Ücretli ilan hakkı satın alındıktan sonra "İlanlarım"a dönülüyor ama satın alma onayı yok (`?checkout=success` yok sayılıyor).
- **U18** Mobilde (375px) yatay taşma yok; ancak herkese açık header hamburger yerine iki satıra sarıyor, dashboard sayfalarında üst üste iki header (public nav + dashboard bar) görünüyor.
- Ayrıca: broker dizini uzmanlık filtresi "Motor yachts" ile küçük harfli etiketleri ("catamaran, rib, luxury, motor, sail") karıştırıyor; seed broker'lar tekrarlı ("Ajaccio Charter & Sales" x3). Django admin'de `ListingPromotion` listesi ilanı "<brand uuid> <model uuid> (STATUS)" olarak gösteriyor (`BoatListing.__str__`).

## 6. Geçen senaryolar (kanıt)

### Herkese açık
- Ana sayfa, `/boats/` (162 ilan, filtreler, sıralama), ilan detayı (paylaşım, özellikler, benzer tekneler, finans kartı), `/brokers/` (160 firma), `/services/professionals/`, `/pricing/`, `/financing/` (hesaplayıcı), `/guides/`, `/valuation/` (POST `/valuation/` 200 → €101k–€245k, 17 karşılaştırılabilir), `/contact/` (POST `/contact/` 201), anlamsal arama ("Capito: about 10 m · up to €200,000 · 2 cabins · Motor yacht · Palma" → 3 sonuç).
- `/services/` ve `/professionals/` → 301 `/services/professionals/`; `sitemap.xml` (960 KB), `robots.txt`, 404 sayfası, `public-settings`, `ui-text/it`, `simulator-config`, `pricing`, `promotion-plans`, `guides` API'leri 200.
- IT dil geçişi (`/it/...` prefix'i) ve 403 sayfası (professional → `/dashboard/staff/`).

### Private seller
- UI ile taslak: tip/marka/model/yıl combobox'ları, başlık/açıklama, teknik alanlar, ülke/bölge/şehir autocomplete (`POST /listings/drafts/` 201).
- Fotoğraf: intent 201 → S3 PUT 200 → complete 202 → SCANNING → READY (1280x860'a yeniden kodlandı).
- Promosyon: diyalog → Stripe Checkout (€149) → `?promotion=success` → webhook `checkout.session.completed` Fulfilled (16:33Z) → `ListingPromotion` Paid → yayınla birlikte aktif (`is_featured: true`, `featured_until 2026-10-07`).
- Gönderim → `PENDING_APPROVAL`, bildirim `listing.submission_received`; staff onayı → `PUBLISHED`, `expires_at 2026-10-23`, bildirim `listing.approved`; herkese açık sayfa ve arama 200.
- Ücretsiz ilan hakkı tüketildi ("Hai esaurito l'annuncio gratuito … 09/23/2027"); ücretli hak: Stripe (€9.99) → order FULFILLED 20 sn içinde, entitlement oluştu, `/paid-listings/` count 1, staff Purchases'ta listelendi.
- Revizyon: fiyat değişikliği → staff "revisions" sekmesi (1) → diff `price 189000 → 185000` → APPROVE → snapshot v2.
- Hesap sayfası, hizmetler sayfası, mesajlar (gelen sorgu göründü), bildirim tercihleri.

### Staff
- Dashboard sayaçları (198 ilan / 415 kullanıcı / 162 broker / 167 profesyonel), moderasyon kuyruğu sekmeleri (initial/revisions/other/suspended/expiring), revizyon inceleme + Approve (`POST decision/` 200), Boats, Users, Brokers, Providers, Leads, Service requests, Subscriptions (MRR €598), Purchases, Entitlement ledger, Advertising (5/5 slot), Content CMS, Email templates (EN/IT/ES matrisi), Taxonomy (207 marka), Reports, Settings, Contact grants.
- Django admin girişi (`staff@nautelo.com`), `ListingPromotion`, `ProcessedWebhookEvent` (7 → 9 olay, hepsi Fulfilled) listeleri.

### Broker
- Dashboard, fleet (sayaçlar/filtreler), yeni ilan formu (finans tahmini kutusu, 20 foto / 1 video hakkı), team (davet → 201, bekleyen liste), profil formu, mesajlar (cevap → 201, okundu → 200), plan sayfası.
- Abonelik: trial checkout → webhook'lar Fulfilled → plan sayfası ACTIVE; portal açılıyor; portaldan iptal (dönem sonunda) Stripe'ta kaydedildi.
- Broker ilanı (API): taslak + 2 foto + `show_finance_estimate` + 84 ay vade → gönder → onay → yayında; herkese açık finans bloğu `monthly_payment 2770.25` (%5, 84 ay, %20 peşinat).

### Professional
- Dashboard (DRAFT uyarısı + "Pay now"), profil formu, servis kataloğu (1 aktif), requests, team (bekleyen davet), plan sayfası.
- Üyelik trial checkout → profil ACTIVE → herkese açık profil (`/services/professionals/professional-hakan-org/`) ve dizin araması listeliyor; iletişim bilgileri maskeli, mesaj sonrası açılıyor.

### Alıcı
- Professional hesabıyla private ilanına sorgu → `POST /inquiries/` 201 → satıcıda konuşma + `inquiry.received` bildirimi; broker profiline sorgu → iletişim bilgisi açıldı (`/contacts/broker/<id>/` 200, "Unlocked on 2026-09-23").

### Otomatik testler (yerel)
- Backend: `uv run pytest` → **2644 passed** (187 s). İlk koşuda 1 hata: `listings/tests/test_public_read_api.py::test_media_entries_carry_a_cdn_url_only_when_a_public_base_is_configured`, nedeni yerel `backend/.env`'deki `MEDIA_SIGNED_URLS=True`; `MEDIA_SIGNED_URLS=False` ile tümü geçti. Test env değişkenine bağımlı; izole edilmeli.
- Frontend: `pnpm run test` (vitest) → **95 dosya / 666 test passed** (41 s).

## 7. Önerilen sıralama

1. F13 + F14 (abonelik durumu ve iptal senkronu) – gelir ve deneme kötüye kullanımı riski.
2. F19 (yayınlı ilan düzenleme) – satıcı için temel işlev.
3. F17 (compare mock) – spesifikasyon ihlali; ya gerçek karşılaştırma ya da sayfayı kaldır.
4. F15 (adaptive pricing) – Stripe ayarı, kod değişikliği gerektirmez.
5. F7, F12, F10, F18 ve marka artıkları (F1).
6. UX notları (U1–U18) tek bir "polish" PR'ında toplanabilir.

## 8. Düzeltme durumu (2026-09-24 sabahı)

Üç PR ile kapatıldı: #476 (yüksek/orta öncelikli bulgular), #477 (düşük öncelik + ilk UX maddeleri), #478 (kalan UX maddeleri). Her düzeltme kendi commit'inde; yerel test paketleri (backend pytest, frontend vitest/eslint/tsc) her PR öncesi tamamen yeşil.

| Madde | Durum | Not |
|---|---|---|
| F13, F14 | ✅ #476 | Deneme kaydı, `cancel_at_period_end` alanı + `customer.subscription.updated` |
| F19 | ✅ #476 | `published_payload` ile form yayınlı içerikten dolar |
| F17 | ✅ #476 | Gerçek karşılaştırma sayfası (`/boats/compare/?ids=`) + "Add to compare" |
| F7 | ✅ #476 | Promosyon durumu sunucudan (`promotion` bloğu) |
| F12 | ✅ #476 | Purchases: sipariş + promosyon + abonelikler tek defterde |
| F10 | ✅ #476 | Marka/model adı, spec başına satır, fotoğraf küçük resimleri |
| F18 | ✅ #476 + #479 | Dashboard menüleri, auth başlıkları, kapalı liste spec değerleri (#476); paket adları, paket seçici ve değerleme sonucu metni (#479) |
| F1 | ✅ #476 | Deploy'da `sync_ui_text` eski "Nauta" metinlerini temizler; iletişim sayfasındaki sahte telefon/e-postalar kaldırıldı (gerçek bilgiler gerekli) |
| F16 | ✅ #476 | `storage_key`/`checksum_sha256` herkese açık API'den çıkarıldı |
| F2, F3, F4, F5, F6, F8, F20 | ✅ #477 | |
| F11 | ✅ #477 (kısmen) | Entitlement ve Boats tabloları okunur; contact-grants bilerek yalnızca ID gösteriyor (spec/test ile sabit) |
| U1, U2, U3, U9, U10, U13, U17 | ✅ #477 | |
| U6, U7, U11, U15, U16, U18 | ✅ #478 | + broker dizini uzmanlık etiketleri, admin `BoatListing.__str__` |
| U5 | ✅ #478 | Checkout artık hesabın dilinde açılıyor |
| F15 | ⏳ Stripe panosu | Adaptive pricing kod dışı: Stripe Dashboard → Settings → Adaptive pricing kapatılmalı |
| U8, seed broker tekrarları | ⏳ veri | Demo/seed verisi temizliği; kod değişikliği değil |
| U12 | ⏳ karar | Leads yalnızca ilan sorgularını listeliyor; broker profil sorguları Messages'ta (tasarım) |
| U14 | ➖ | Honeypot alanı kodda zaten ekran dışı (`left:-9999px`, aria-hidden); tekrar üretilemedi |
| N1 (staff test-send) | ✅ #477 | Sonuç butonun yanında, sağlayıcı sebebi gösteriliyor; posta ulaşmıyorsa staff@nautelo.com gerçek bir kutu mu kontrol edilmeli |
