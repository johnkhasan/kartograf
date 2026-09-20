# Kartograf — Map Poster & Wallpaper Creator

Xohlagan shahar/joyning uslubli xarita posterini yasab, yuqori sifatli
PNG/JPEG holida yuklab olish. React + TypeScript + MapLibre GL bilan
yozilgan, bepul OpenFreeMap vektor tile'lari va OpenStreetMap
ma'lumotlaridan foydalanadi.

## Imkoniyatlar

- **Location** — Nominatim orqali joy qidirish + "Get my location" (geolokatsiya)
- **Theme** — 10 ta tayyor rang mavzusi (Midnight Blue, Noir, Carrara, ...)
- **Layout** — bosma (A3/A4/A5/Letter/Square) va ekran (Instagram, wallpaper, 4K) formatlari
- **Style** — shahar/davlat/koordinata matnini yoqish, 8 xil shrift
- **Layers** — landcover/buildings/water/parks/roads/rail/aeroway qatlamlari + zoom slayderi
- **Markers** — 6 ta ikon, sudrab ko'chirish, o'lchov va rang sozlash
- **Juftlik** — sevishganlar rejimi: ikkita joy, orasida yoy yoki geodezik chiziq,
  yurak belgilari va real masofa (km/mil) poster matnida
- **Kollaj** — 2–4 shaharni bitta posterda, har biri alohida panel
- **Osmon** — tanlangan joy va vaqtdagi yulduzli osmon xaritasi
- **Routes** — xaritada bosib marshrut chizish
- **Download** — 1x/2x/3x sifatda, xarita + belgilar + matn birga eksport (300 DPI gacha)

## Ishga tushirish

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Texnologiyalar

- **React 19 + TypeScript** — UI
- **MapLibre GL JS** — vektor xarita rendering
- **Zustand** — holat boshqaruvi
- **OpenFreeMap** — bepul vektor tile'lar (API kalitsiz)
- **Nominatim (OSM)** — geokodlash

Eksport jonli preview'dan alohida, yashirin yuqori o'lchamli xarita render qilib,
`<canvas>` ustiga matn/belgilarni chizib PNG/JPEG hosil qiladi.

## Litsenziya / atribusiya

Xarita ma'lumotlari © OpenStreetMap contributors (ODbL). Tile'lar OpenFreeMap.
Yulduz katalogi va burj chiziqlari — [d3-celestial](https://github.com/ofrohn/d3-celestial)
(BSD-3). Poster shriftlari — Google Fonts (OFL), `scripts/fetch-fonts.py` orqali
kerakli belgilargagina qisqartirilgan.
