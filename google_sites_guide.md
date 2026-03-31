# 🎮 Hướng Dẫn Tạo Google Sites Game Portal

> [!IMPORTANT]
> Hướng dẫn tạo trang Google Sites giống **"Classroom G-"** (https://sites.google.com/view/drive-u-7-home-10/)

## Tổng Quan Cấu Trúc Trang

Trang "Classroom G-" có cấu trúc:
- **Sidebar trái**: Menu navigation với categories (Flash Games, Driving Games, Last Games) + link từng game
- **Trang chủ**: Banner + grid ảnh game (mỗi ảnh link đến trang game riêng)
- **Trang game riêng**: Mỗi game có 1 sub-page chứa iframe embed game
- **Theme**: Màu tím đậm gradient

---

## Bước 1: Tạo Google Sites Mới

1. Vào **[sites.google.com](https://sites.google.com)** → đăng nhập Gmail
2. Nhấn **"+ Blank"** (Trang trống) hoặc **"+ Tạo mới"**
3. Đặt tên site ở góc trên trái (ví dụ: `Classroom G+`)

## Bước 2: Cài Đặt Theme Tím

1. Ở panel bên phải, chọn tab **"Themes"** (Chủ đề)
2. Chọn theme **"Diplomat"** hoặc **"Vision"** (tone tối)
3. Nhấn vào **biểu tượng bảng màu** → Chọn **Custom color**
4. Nhập mã màu tím: `#1a0a3e` hoặc `#2d1b69`
5. Font: chọn **"Roboto"** hoặc **"Open Sans"**

## Bước 3: Tạo Trang Chủ (Homepage)

### 3.1 Header/Banner
1. Xóa header mặc định
2. Chọn **Insert → Text box** → Gõ tiêu đề: `Unblocked Games - Classroom G+`
3. Chỉnh font size **lớn, bold, màu trắng**
4. Thêm logo: **Insert → Image** → upload ảnh logo

### 3.2 Category Buttons
1. **Insert → Button** → Tạo 3 buttons:
   - `Last Games` → link đến trang `/new-games`
   - `Flash Games` → link đến trang `/flash-games`  
   - `Driving Games` → link đến trang `/driving-games`

### 3.3 Game Grid (Phần quan trọng nhất!)

Cách tạo grid game trên trang chủ:

**Cách 1: Upload ảnh thủ công (Đơn giản)**
1. **Insert → Image** → Upload ảnh thumbnail game
2. Resize ảnh cho đều nhau (khoảng 150x150)
3. Thêm **text dưới ảnh** = tên game
4. **Click vào ảnh** → Add link → Dán URL trang game
5. Lặp lại cho mỗi game
6. Kéo các ảnh thành **3-6 cột** bằng cách kéo resize

**Cách 2: Dùng Embed HTML (Tốt hơn, tự động grid)**
1. **Insert → Embed** → Chọn tab **"Embed code"**
2. Paste đoạn HTML grid đã tạo sẵn (xem script `generate_gsites.js` bên dưới)
3. Nhấn "Insert"

> [!TIP]
> Sử dụng script `generate_gsites.js` mà tôi đã tạo để tự động tạo HTML cho trang chủ và từng trang game!

## Bước 4: Tạo Sub-pages Cho Từng Game

### 4.1 Tạo page mới
1. Ở panel phải → chọn tab **"Pages"**
2. Nhấn **"+"** → **"New page"**
3. Đặt tên page = tên game (ví dụ: `Zooplop`)
4. Kéo page vào dưới category phù hợp để tạo sub-page

### 4.2 Embed game vào page
1. Mở trang game vừa tạo
2. **Insert → Embed** → Tab **"By URL"**
3. Dán URL iframe game: `https://inkyedu118.github.io/g50/class-1`
4. Nhấn **"Insert"**
5. **Resize iframe** cho to (kéo rộng hết trang, cao khoảng 600-800px)

### 4.3 Thêm nội dung SEO
- Thêm text box phía dưới: mô tả game, cách chơi
- Thêm ảnh thumbnail game

## Bước 5: Tổ Chức Sidebar Navigation

1. Panel phải → tab **"Pages"**
2. Tạo các trang category:
   - `Flash Games` (trang cha)
   - `Driving Games` (trang cha)
   - `New Games` / `Last Games` (trang cha)
3. Kéo các trang game vào **dưới** trang category tương ứng
4. Các sub-page sẽ tự động hiện trong sidebar

> [!WARNING]
> Google Sites giới hạn **~200 pages** cho mỗi site. Nếu bạn có 1000+ games, bạn sẽ cần chia thành nhiều sites hoặc chỉ thêm game phổ biến nhất.

## Bước 6: Publish

1. Nhấn nút **"Publish"** ở góc trên phải
2. Đặt URL: `sites.google.com/view/ten-site-cua-ban`
3. Chọn **"Anyone on the web can find and view"**
4. Nhấn **"Publish"** lần nữa

---

## 🛠 Script Tự Động (`generate_gsites.js`)

Tôi đã tạo script `generate_gsites.js` trong project của bạn. Script này sẽ:

1. **Tạo HTML embed cho trang chủ** - Grid ảnh game với link
2. **Tạo HTML embed cho từng trang game** - Iframe + nút fullscreen
3. Xuất ra file `gsites_output/` để bạn copy-paste vào Google Sites

### Cách sử dụng:
```bash
node generate_gsites.js
```
Sau đó mở các file HTML trong thư mục `gsites_output/` và copy nội dung vào Google Sites qua **Insert → Embed → Embed code**.

---

## ⚡ Mẹo Pro

| Mẹo | Chi tiết |
|-----|---------|
| **Tốc độ** | Mỗi game page mất ~1-2 phút nếu dùng embed code có sẵn |
| **SEO** | Google Sites tự động index trên Google nếu set public |
| **Giới hạn** | Max ~200 pages/site, max 15MB/trang upload |
| **Iframe** | Một số game có thể bị block bởi X-Frame-Options |
| **Mobile** | Google Sites tự responsive, không cần code thêm |
| **Custom domain** | Có thể gắn domain riêng trong Settings |

## So Sánh: Google Sites vs GitHub Pages

| Tính năng | Google Sites | GitHub Pages (hiện tại) |
|-----------|-------------|----------------------|
| Customize CSS | ❌ Rất hạn chế | ✅ Toàn quyền |
| Số lượng game | ⚠️ ~200 pages max | ✅ Không giới hạn |
| SEO | ⚠️ Cơ bản | ✅ Full control |
| Dễ tạo | ✅ Kéo thả | ⚠️ Cần code |
| Tốc độ | ✅ Nhanh (Google CDN) | ✅ Nhanh |
| Miễn phí | ✅ | ✅ |
| Domain | ✅ Custom domain | ✅ Custom domain |

> [!NOTE]
> Google Sites **tốt để làm thêm 1 trang phụ** nhằm backlink về trang GitHub Pages chính, hoặc để target thêm keyword khác.



 node generate_gsites.js --games 50 --site-name "Classroom G+" --site-url "my-game-site-123"