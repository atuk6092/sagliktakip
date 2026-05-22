# Tansiyon Kilo Takibi

Tansiyon, kilo, yürüyüş ve yeme takibi için kurulabilir PWA uygulaması.

## Özellikler

- ✅ Tansiyon: büyük/küçük tansiyon, nabız, not
- ✅ Kilo takibi
- ✅ Yürüyüş: dakika, adım, mesafe
- ✅ Yeme/öğün: öğün tipi, yiyecek, kalori
- ✅ Tek dashboard, özet kartları, grafikler
- ✅ Dışa aktar / içe aktar JSON yedekleme
- ✅ PWA: telefonda ana ekrana eklenebilir
- ✅ Çevrimdışı çalışır; internet gelince sayfa tekrar kullanılabilir
- ✅ Google ile giriş ve bulut senkron için Firebase desteği hazır

## Hemen çalıştırma

### En kolay yöntem

`index.html` dosyasını tarayıcıda açın. Uygulama yerel modda çalışır ve verileri bu cihazda saklar.

> Not: PWA kurulum düğmesi ve servis worker için dosyayı bir web sunucusundan açmak gerekir. Aşağıdaki yöntem önerilir.

### Yerel sunucu ile çalıştırma

Klasör içinde terminal açın:

```bash
python3 -m http.server 8080
```

Sonra tarayıcıdan açın:

```text
http://localhost:8080
```

Telefonda aynı Wi‑Fi ağındaysanız bilgisayar IP adresiyle açabilirsiniz:

```text
http://BILGISAYAR_IP_ADRESI:8080
```

## Telefona PWA olarak kurma

1. Uygulamayı Chrome/Edge/Safari ile açın.
2. Chrome/Edge: Menü > Ana ekrana ekle / Uygulamayı yükle.
3. iPhone Safari: Paylaş > Ana Ekrana Ekle.

## Google ile giriş ve bulut veriler

Bu özellik güvenlik nedeniyle sizin Firebase projenizle çalışır. Yapılması gerekenler:

1. <https://console.firebase.google.com/> üzerinden yeni proje oluşturun.
2. Build > Authentication > Sign-in method bölümünden **Google** sağlayıcısını açın.
3. Build > Firestore Database bölümünden Firestore veritabanı oluşturun.
4. Project settings > Your apps > Web app bölümünden web uygulaması ekleyin.
5. Verilen Firebase config bilgisini `firebase-config.js` içine yapıştırın.
6. Authentication > Settings > Authorized domains kısmına yayınladığınız domaini veya `localhost` ekleyin.

`firebase-config.js` örneği:

```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "proje-adiniz.firebaseapp.com",
  projectId: "proje-adiniz",
  storageBucket: "proje-adiniz.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

Önerilen Firestore güvenlik kuralı:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/records/{recordId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## APK hakkında

Bu paket PWA olarak hazırdır. Android'de Chrome ile "Uygulamayı yükle" dediğinizde APK benzeri ayrı uygulama gibi çalışır.

Gerçek `.apk` dosyası üretmek için PWA'yı şu yöntemlerden biriyle paketleyebilirsiniz:

- Android Studio + Trusted Web Activity
- Capacitor
- Bubblewrap

İsterseniz bir sonraki mesajda bu PWA için **Capacitor Android proje iskeletini** de hazırlayabilirim; ancak imzalı APK üretmek için bilgisayarınızda Android Studio/JDK gerekecek.
