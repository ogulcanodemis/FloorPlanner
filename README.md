# Floor Plan Designer

Modern ve kullanıcı dostu bir kat planı tasarım uygulaması. React ve Fabric.js kullanılarak geliştirilmiştir.



## 🌟 Özellikler

### Çizim Araçları
- **Temel Şekiller**: Dikdörtgen, üçgen, yamuk
- **Özel Elemanlar**: Merdiven, asansör, giriş, çizgi
- **Metin Ekleme**: Oda isimleri ve açıklamalar için
- **Katmanlar**: Çoklu katman desteği ile organize tasarım
- **Kılavuzlar**: Hassas yerleştirme için kılavuz çizgileri
- **Izgaraya Yapışma**: Nesneleri otomatik hizalama

### Düzenleme Araçları
- **Seçim**: Tekli ve çoklu nesne seçimi
- **Silme**: Tekli silme ve toplu silme onayı
- **Geri Al/İleri Al**: Sınırsız geri alma geçmişi
- **Renk Özelleştirme**: Oda dolgu, kenarlık ve metin renkleri
- **Katman Yönetimi**: Görünürlük ve kilit kontrolü

### Canvas Ayarları
- **Arka Plan**: Düz, ızgara veya çizgili
- **Boyut**: Özelleştirilebilir canvas boyutları
- **Izgara Boyutu**: Ayarlanabilir ızgara aralığı

### Dışa Aktarma
- PNG formatında görüntü
- SVG formatında vektörel çizim
- JSON formatında proje dosyası

## 🚀 Başlangıç

### Gereksinimler
- Node.js (v14 veya üzeri)
- npm veya yarn

### Kurulum

```bash
# Repoyu klonlayın
git clone https://github.com/ogulcanodemis/floor-plan-designer.git

# Proje dizinine gidin
cd floor-plan-designer

# Bağımlılıkları yükleyin
npm install

# Uygulamayı başlatın
npm start
```

## 💻 Kullanım

1. **Şekil Ekleme**
   - Sol menüden istediğiniz şekli seçin
   - Canvas'a tıklayarak şekli ekleyin
   - Şekli sürükleyerek konumlandırın

2. **Düzenleme**
   - Şekli seçin ve sürükleyerek taşıyın
   - Köşelerden tutup boyutlandırın
   - Renk seçicilerle özelleştirin

3. **Katmanlar**
   - "Add Layer" ile yeni katman ekleyin
   - 👁️ ile katmanı gizleyin/gösterin
   - 🔒 ile katmanı kilitleyin/kilidini açın

4. **Kılavuzlar**
   - "Guides" ile kılavuzları açın/kapatın
   - "Snap to Grid" ile ızgaraya yapışmayı etkinleştirin
   - Grid Size ile ızgara boyutunu ayarlayın

5. **Dışa Aktarma**
   - PNG: Bitmap görüntü olarak kaydedin
   - SVG: Vektörel format olarak kaydedin
   - JSON: Proje dosyası olarak kaydedin

## 🛠️ Teknik Detaylar

### Kullanılan Teknolojiler
- React
- TypeScript
- Fabric.js
- CSS Modules

### Proje Yapısı
```
floor-plan-designer/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── App.tsx
│   └── index.tsx
├── public/
└── package.json
```

## 🤝 Katkıda Bulunma

1. Bu repoyu fork edin
2. Yeni bir branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👏 Teşekkürler

- Fabric.js ekibine harika canvas kütüphanesi için
- React ekibine mükemmel framework için
- Tüm katkıda bulunanlara

---

Geliştirici: [Oğulcan Odemis]
İletişim: ogulcan.odemis28@gmail.com
linkedin: https://www.linkedin.com/in/ogulcanodemiss/
