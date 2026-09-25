# Broker paneli kullanılabilirlik testi — 2026-09-24

Hesap: broker@nautelo.com (dev.nautelo.com, kullanıcının Chrome'u). Kapsam: `/dashboard/broker/*` altındaki tüm sayfalar (Dashboard, Fleet, Add vessel, Leads, Messages + görüşme, Team, Profile, My plan, Notifications), listeleme düzenleme akışı (`/sell/<id>/`), tanıtım (Promote) akışı, sol menü ve bildirim zili.

Öncelik: **P1** kafa karıştırıyor / iş yaptırmıyor · **P2** verimsiz · **P3** cila.

Not: Sol menü (Home butonu, iç boşluk, zil hizası, sekme başlığı) staff turunda (stafftest.md S1/S4/S6) ortak bileşende düzeltildi; broker alanı aynı düzeltmeyi PR #481 ile alıyor. Burada tekrar edilmedi.

## 1. Çerçeve ve adlandırma

| # | Ö | Bulgu | Öneri |
|---|---|-------|-------|
| B1 | P1 | Dashboard'un adı yok: üst etiket "YACHT BROKERAGE DESK", başlık firma adı ("hakan broker"), sekme başlığı "Dashboard · Brokerage area". Menüde "Dashboard". | Üst etiket "Brokerage / Dashboard", başlık "Dashboard", firma adı alt satırda; firma sayfasına "View public page" bağlantısı. |
| B2 | P1 | Üst etiketler her sayfada başka bir jargon: "BROKERAGE CRM", "BROKERAGE CRM / COMPANY PROFILE", "FLEET MANAGEMENT", "MARITIME BROKERAGE REGISTRY", "YOUR MESSAGES" (görüşme sayfası) ve "BROKERAGE CRM" (liste sayfası). | Hepsi "Brokerage / <menü adı>". |
| B3 | P1 | Sayfa başlıkları menü adıyla uyuşmuyor: Fleet → "Active vessel inventory"; Profile → "Brokerage profile"; Leads → "Messages"; Add vessel → sekme "Fleet"; düzenleme → "Sell your boat". | Başlık = menü adı ("Fleet", "Profile", "Leads", "Add a vessel", "Edit vessel"). |
| B4 | P1 | Masaüstünde sol menünün üstünde ikinci bir yatay çubuk ("Dashboard · Messages") var; menüyü tekrarlıyor, diğer alanlarda yok. | Kaldır. |
| B5 | P2 | Dashboard'da "Mandate inventory" başlığı (jargon); yalnız 5 tekne gösteriliyor ama "tümünü gör" bağlantısı yok. | "Your vessels" + "All vessels" bağlantısı (Fleet). |
| B6 | P2 | KPI kartları (Published listings, Pending approvals, Unread messages, New inquiries) tıklanmıyor; "Pending approvals" neyin onayı belli değil. | Kartlar ilgili sayfaya bağlansın; "Awaiting review" + "Vessels waiting for staff approval" açıklaması. |

## 2. Filo ve listeleme akışı

| # | Ö | Bulgu | Öneri |
|---|---|-------|-------|
| B7 | P1 | "Edit listing" broker'ı **Seller area**'ya atıyor: sol menü "SELLER AREA / My listings" oluyor, üstte herkese açık site menüsü beliriyor, başlık "Sell your boat", kaydedince "My listings"e (özel satıcı) dönülüyor. Broker kendi alanından çıktığını fark etmiyor. | Düzenleme broker alanında açılsın: `/dashboard/broker/fleet/<id>/`, başlık "Edit vessel", geri bağlantısı Fleet. |
| B8 | P1 | Aynı düzenleme ekranında "Financing estimate" bölümü yok (Add vessel'da var): form broker kimliğini bilmediği için finansman ayarları düzenlemede kayboluyor ve kaydedilmiyor. | Düzenleme ekranı broker kimliğini forma geçirsin. |
| B9 | P2 | Aynı durum için üç ad: kart rozeti "Publicly live", filtre sekmesi "Active", KPI "Published". | Hepsi "Published". |
| B10 | P2 | Fleet KPI'ları: "Managed vessels", "Published fleet value 245K" (para birimi yok), "In review", "Drafts". | "Vessels", "Published value €245K"; sekme sayıları zaten var, kartlar tıklanınca filtre seçsin. |
| B11 | P2 | Add vessel üst etiketi "MARITIME BROKERAGE REGISTRY", açıklama "List your vessel across the Spanish and Italian maritime marketplace." (özel satıcıyla aynı metin). | Broker için üst etiket "Brokerage / Fleet"; açıklama "The vessel is published under your brokerage after staff review." |
| B12 | P3 | Kartta "2 views" var ama görüntülenme neye göre (toplam mı, 7 gün mü) yazmıyor. | "2 views in total". |
| B13 | P3 | "Promote this boat" pop-up'ı dashboard'da bazen görünmüyor (sayfa kaydırılmış, pencere görünmedi); tanıtım fiyat/süre seçimi My plan altındaki "Promotion" bölümünde de var; iki giriş noktası. | Pop-up davranışını deploy sonrası tekrar doğrula; My plan'daki bölüm kalsın ama sayfanın sonuna alınsın. |

## 3. Leads ve mesajlar

| # | Ö | Bulgu | Öneri |
|---|---|-------|-------|
| B14 | P1 | Leads sayfasının başlığı ve açıklaması Messages ile bire bir aynı ("Messages — Conversations started from your listings and profile."); filtre çipleri Messages sayfasına götürüyor; boş durum metni "Nothing here yet. Enquiries from buyers appear here once your listings are live…" — oysa ilan yayında ve Messages'da 2 görüşme var. Broker Leads'in ne olduğunu anlayamıyor. | Başlık "Leads", açıklama "Enquiries buyers sent about one of your vessels. Enquiries about your brokerage as a whole are under Messages."; filtre çipleri yok; boş durum "No enquiries about your vessels yet." (İki yüzeyin ayrı kalması tasarım kararı; yalnız açıklama düzeltiliyor.) |
| B15 | P1 | Zaman damgaları ABD biçiminde ve saniyeli: "9/23/2026, 9:30:25 PM" (görüşme listesi, görüşme, bildirimler). Sayfanın geri kalanı gün/ay/yıl ("30/09/2026", "23/10/2026"). | Tek biçim: "23 Sep 2026, 21:30" (dil: en-GB/it/es), saniye yok. |
| B16 | P2 | Görüşme sayfasında üst etiket "YOUR MESSAGES", listede "BROKERAGE CRM". Görüşme başlığı "QA broker inquiry" ama hangi tekne/profil için olduğu yalnız satırdaki "Broker · hakan broker" etiketinden anlaşılıyor. | Üst etiket "Brokerage / Messages"; görüşme başlığının altına bağlam satırı ("About: your brokerage profile" / "About: <tekne>"). |
| B17 | P3 | Görüşme satırındaki "Broker · hakan broker" etiketi broker'ın kendi adını gösteriyor (karşı taraf değil). | Broker görünümünde bağlam etiketi "Profile enquiry" / "<tekne adı>" olsun. |

## 4. Team, Profile, My plan, Notifications

| # | Ö | Bulgu | Öneri |
|---|---|-------|-------|
| B18 | P1 | Team: rol rozetleri "ADMIN / MANAGER / AGENT / VIEWER" hiçbir yerde açıklanmıyor; davet formundaki rol seçici ham enum. "Access" sütunu "Listings - Team - Messages" (ne demek?). | Rol açıklaması (staff'taki gibi açılır "What the roles mean"); seçici "Admin – full access" gibi okunur etiketler; Access sütunu "Can edit listings, manage team, read messages". |
| B19 | P2 | Deactivate / Reactivate ve davet "Cancel" onaysız tek tık. | window.confirm. |
| B20 | P2 | Profile: etiketler karışık ("NAME", "PUBLIC EMAIL" büyük; "Country", "Region", "City" normal); bölge (Region) boş kalıyor (Rome/Italy). Firma sayfasına bağlantı yok. | Etiket biçimini eşitle; "View public page" bağlantısı. |
| B21 | P1 | My plan: aynı bilgi iki kez ve iki biçimde: "Paid until 23/10/2026. Renews automatically." (üst kart) ve "Brokerage active - Renews 2026-10-23" (plan kartı). | Plan kartında tarihi kaldır (üst kart zaten söylüyor) veya aynı biçim. |
| B22 | P2 | My plan pazarlama dili: "ASSIGNED PLAN", "COMMERCIAL CAPACITY SELECTION / Scalable Membership Tiers", "Active Vessel Listings 1 / 5 used — 20% capacity utilized — 4 slots remaining", "Team Seats — 50% allocation", "Currently Enrolled", "Request this tier". | "Your plan", "Other plans", "Published vessels 1 of 5 (4 free)", "Team seats 1 of 2 (1 free)", "Current plan", "Request this plan". |
| B23 | P1 | Notifications: iki bildirim başlıksız ve gövdesiz (boş satır, yalnız tarih) — mesaj bildirimi anahtarı (`notification.inquiry_received`) ön yüzde çevrilmemiş. | Anahtarı ekle: "New enquiry" / "A buyer sent you a message. Open it in Messages." (EN/IT/ES). |
| B24 | P2 | Notifications sayfasının başlığı yok (doğrudan "Recent notifications" ile başlıyor), üst etiket yok. | "Brokerage / Notifications" + h1 "Notifications". |
| B25 | P3 | Bildirim listesinde tıklanan bildirim hedefe gidiyor ama okunmuş işareti sonra geliyor; sorun değil, not. | — |

## 5. Yapılanlar

| # | Durum | Not |
|---|-------|-----|
| B1 | ✅ | "Brokerage / Dashboard", h1 "Dashboard", firma adı + "View public page" |
| B2 | ✅ | Tüm üst etiketler "Brokerage / <menü adı>" |
| B3 | ✅ | Fleet, Profile, Leads, Add a vessel, Edit vessel |
| B4 | ✅ | İkinci nav çubuğu (layout) kaldırıldı |
| B5 | ✅ | "Your vessels" + "All vessels" |
| B6 | ✅ | KPI kartları bağlantı; "Awaiting review" + açıklama |
| B7 | ✅ | `/dashboard/broker/fleet/<id>/` broker alanında; kart bağlantısı ve kaydetme sonrası adres buna göre |
| B8 | ✅ | Düzenleme formu broker kimliğini alıyor (financing estimate geri geldi) |
| B9 | ✅ | "Published" |
| B10 | ✅ | "Vessels", "Published value €245K"; kartlar filtreyi seçiyor |
| B11 | ✅ | "Brokerage / Fleet" + broker açıklaması (EN/IT/ES) |
| B12 | — | Değişiklik yok (P3) |
| B13 | ✅ | Promotion bölümü My plan'ın sonunda; Fleet'te "Extend promotion" pop-up'ı canlıda doğrulandı (tam ekran, görünür) |
| B14 | ✅ | Leads: başlık, açıklama, çip yok, boş durum metni |
| B15 | ✅ | `formatDateTime`: "23 Sep 2026, 21:30" (görüşme listesi, görüşme, bildirimler) |
| B16 | ✅ | Üst etiket; görüşme başlığının altında "About your brokerage profile" / "About: <tekne>" |
| B17 | — | Satır etiketi olduğu gibi (testler bağlam tipini sabitliyor; P3) |
| B18 | ✅ | Rol açıklaması, okunur rol adları, "Can edit listings, read messages" |
| B19 | ✅ | Deactivate onay soruyor |
| B20 | ✅ | Etiket biçimi eşitlendi; "View public page" |
| B21 | ✅ | Plan kartındaki ikinci tarih kaldırıldı |
| B22 | ✅ | "Your plan", "Other plans", "1 of 5 · 4 free", "Current plan", "Request this plan" |
| B23 | ✅ | `notification.inquiry_received` EN/IT/ES |
| B24 | ✅ | Başlık ve üst etiket |

