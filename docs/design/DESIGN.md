# DESIGN.md — Hướng thiết kế giao diện Nouri

Phiên bản 2 · chốt 31/10/2026 · nguồn: canvas "Nouri UI mẫu" (artboard TongQuan7s, CongThuc7s, Kho7s, KhoThem7s — "ĐÃ CHỐT").
Cập nhật 02/11/2026 (UI-12): khớp với giao diện thật sau các lượt UI-1 → UI-11 (mục 3.2, 4, 10, 12, 14, 16).
Ảnh mẫu đặt trong `docs/design/mockups/`. File này là **nguồn sự thật về giao diện**: mọi lượt làm UI phải đọc trước và tự nghiệm thu theo mục 15.

---

## 1. Mục tiêu

### 1.1 Người dùng
- Người Việt 20–45 tuổi, nấu ăn cho bản thân hoặc gia đình; dùng trên điện thoại khi đi chợ, đứng bếp; dùng trên máy tính khi lên thực đơn tuần.
- Không phải chuyên gia dinh dưỡng: cần con số rõ, lời khuyên cụ thể, thao tác ít bước.

### 1.2 Mỗi trang phải trả lời được ngay (trong 5 giây)
| Trang | Câu hỏi người dùng | Hành động chính |
|---|---|---|
| Tổng quan | Hôm nay ăn gì, đã ăn bao nhiêu, có gì sắp hỏng? | Đánh dấu "Đã ăn", nấu món gợi ý |
| Kho | Trong tủ có gì, cái gì cần dùng trước? | Thêm thực phẩm, quét hóa đơn |
| Thực đơn | Tuần này ăn gì, cần mua gì? | Tạo thực đơn, đánh dấu đã mua |
| Công thức | Nấu món gì hợp với tôi và với tủ bếp? | Mở một công thức |
| Chi tiết công thức | Nấu thế nào, tôi đủ nguyên liệu chưa, có hợp tôi không? | Thêm vào thực đơn, chia sẻ |
| Cộng đồng | Mọi người nấu gì? | Đăng bài, thích, bình luận |
| Trợ lý AI | Hỏi nhanh về dinh dưỡng | Gửi câu hỏi |
| Hồ sơ | Mục tiêu và giới hạn ăn uống của tôi | Lưu hồ sơ |
| Admin | Hệ thống đang thế nào, cần xử lý gì? | Quản lý món, người dùng, bài viết |

### 1.3 Ba tiêu chí tổng thể
1. **Thống nhất**: mọi trang dùng chung token, thành phần, giọng văn; nhìn một ảnh chụp bất kỳ là biết của Nouri.
2. **Dễ dùng**: hành động chính luôn dễ thấy nhất trang; không trang nào có hơn 1 nút chính trong cùng một vùng.
3. **Không giống AI/template**: qua được toàn bộ checklist mục 3.

---

## 2. Xu hướng áp dụng (có chọn lọc)
Lấy tinh thần của các sản phẩm hiện nay (ứng dụng nấu ăn, sức khỏe, công cụ quản lý), **không chép kiểu trang trí**.

| Xu hướng | Áp dụng thế nào trong Nouri |
|---|---|
| Ảnh thật làm nhân vật chính | Ảnh món ăn lớn, cùng một phong cách chụp (ánh sáng ấm, góc 45° hoặc từ trên xuống), không ảnh 3D/minh họa AI |
| Typography biên tập (editorial) | Tiêu đề Fraunces lớn, nội dung Be Vietnam Pro; phân cấp bằng cỡ chữ và khoảng trắng, không bằng khung màu |
| Bố cục bất đối xứng có chủ đích | Khối quan trọng nhất to nhất (bento có thứ bậc), không lưới thẻ đều tăm tắp ở mọi nơi |
| Chế độ sáng/tối | Mặc định sáng, nút chuyển trên menu, nhớ lựa chọn |
| Giao diện "dữ liệu là nội dung" | Số liệu thật (calo, ngày còn lại, số nguyên liệu có trong kho) đặt ngay cạnh hành động liên quan |
| Tương tác phản hồi rõ | Đánh dấu "Đã ăn" có phản hồi tức thì; trạng thái tải bằng skeleton; lỗi tại chỗ |
| Mobile-first cho thao tác | Vùng bấm ≥ 44px, nút chính dễ với ngón cái, bảng biến thành thẻ trên điện thoại |
| Tiết chế | Ít màu, ít bóng, ít hiệu ứng; mỗi trang chỉ một điểm nhấn |

---

## 3. Checklist "không giống AI" (bắt buộc, kiểm được)

### 3.1 Cấm tuyệt đối
- [ ] Emoji trong giao diện (kể cả tiêu đề, nút, chip).
- [ ] Gradient trang trí, kính mờ (`backdrop-filter`), blob, lá/chanh/hoa văn trang trí, icon ✨/sparkle.
  Ngoại lệ (chốt 10/11/2026): **hero trang chủ** ("bàn ăn trong vòm") được dùng **ảnh trong khung vòm** (bo tròn đỉnh) có viền
  sage mảnh đồng tâm (`outline-offset`); tiêu đề và logo trang chủ dùng **Fraunces** (không nghiêng).
  Không có chữ đặt trên ảnh, không gradient. Trang đăng nhập có lớp tối `--login-scrim` dưới slogan. Mọi nơi khác vẫn không gradient,
  không blob.
- [ ] Số liệu minh họa không có thật ("2.340 thành viên", "245 món", "tiết kiệm 120.000đ" tự đặt).
- [ ] Chữ < 13px; chữ xám nhạt không đạt tương phản 4.5:1.
- [ ] Tiêu đề phụ in hoa giãn chữ (eyebrow) đặt trên **mọi** tiêu đề. Nhãn in hoa chỉ dùng cho nhãn cột bảng hoặc nhãn trường rất ngắn, và không quá 1 lần trong một khối.
- [ ] Chuỗi meta nối bằng dấu chấm giữa ("Việt Nam · Giàu đạm · 30 phút") — thay bằng nhãn riêng hoặc xuống dòng có cấu trúc.
- [ ] Mũi tên "→" gắn vào chữ trên nút/liên kết (dùng icon đúng nghĩa nếu cần, và chỉ khi điều hướng).
- [ ] Đánh số 01/02/03 cho nội dung không phải trình tự (chỉ đánh số các bước nấu).
- [ ] Hiệu ứng mờ-trượt-lên cho từng section khi cuộn; hover nảy/phóng to trên mọi thẻ.
- [ ] Câu chữ quảng cáo chung chung: "Hành trình dinh dưỡng thông minh", "Trải nghiệm tuyệt vời", "Khám phá ngay". Trộn tiếng Anh ("healthy", "eat clean", "Low Carb") trong nhãn.

### 3.2 Phải có
- [ ] Mỗi trang có **một** điểm nhấn thị giác duy nhất (ảnh hero, vòng calo, hoặc tiêu đề lớn) — phần còn lại yên tĩnh.
- [ ] Thứ bậc thẻ khác nhau: thẻ quan trọng lớn hơn/đặt trước; không phải mọi khối đều là một card cùng bo góc cùng viền.
- [ ] Khoảng trắng phân tách trước, đường kẻ mảnh sau, khung card sau cùng.
- [ ] Chữ nghiêng chỉ dùng ở logo "nouri.". Tiêu đề (H1–H3) không in nghiêng và không tô màu riêng cho một cụm chữ (UI-12 bỏ cụm nghiêng màu accent ở H1 của mọi trang vì đó là dấu hiệu "template").
- [ ] Lời văn cụ thể dựa trên dữ liệu thật: "Ức gà còn 2 ngày — nấu tối nay?" thay vì "Gợi ý thông minh cho bạn".
- [ ] Biểu tượng một bộ duy nhất (lucide), nét 1.75–2px, cỡ 20/24px, luôn đi kèm chữ hoặc `aria-label`.

> Ghi chú: hướng đã chốt dùng nền sáng ấm + tiêu đề serif. Đây là chất liệu dễ bị nhìn thành "template" nếu lạm dụng, nên giới hạn ở mục 3.2 là bắt buộc: chữ nghiêng chỉ ở logo, nền chính gần trắng (#FBFAF6) chứ không phải kem đậm, và điểm nhấn dựa vào ảnh món ăn thật hoặc số liệu thật (vòng calo, số món).

---

## 4. Màu (token CSS, hai chế độ)

> **Hai nhóm trang (chốt 10/11/2026):** trang **công khai** — trang chủ, đăng nhập, đăng ký — dùng bộ màu thương hiệu **xanh rừng / ngà**
> (`--home-*`, `--login-*`: forest #173F32, ivory #FAF8F2, gold #F6DFA6, sage #A8BDA5). Trang **trong ứng dụng** (sau khi đăng nhập) dùng
> **bảng màu bản 8** (`docs/design/ke-hoach-ui8.md`); bảng dưới đây là bản 2, sẽ được thay khi làm bản 8.
Chỉ dùng biến; **không viết mã màu cứng** trong CSS của trang/thành phần.

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--bg` | #FBFAF6 | #111814 | Nền trang |
| `--surface` | #FFFFFF | #18211C | Card, bảng, hộp thoại |
| `--surface-2` | #F3F1EA | #202B25 | Nền phụ: nhóm menu, footer, khối phụ |
| `--ink` | #17302A | #F2EFE7 | Chữ chính |
| `--ink-2` | #3C4F47 | #CDD1C7 | Đoạn văn phụ |
| `--muted` | #5E6D66 | #A9B1A6 | Nhãn, chú thích |
| `--line` | #E3E1D8 | #2A352F | Đường kẻ, viền card |
| `--action` | #15483C | #2F725D | **Nền**: nút chính, chip đang chọn |
| `--action-hover` | #0F3A30 | #3A8270 | Hover nút chính (nền) |
| `--action-text` | #15483C | #8FC2AE | **Chữ và viền** màu action: liên kết, mục menu đang chọn, chữ nút phụ, viền ô nhập đang focus, outline focus |
| `--on-action` | #FFFFFF | #FFFFFF | Chữ trên nền `--action` / `--action-hover` |
| `--accent` | #2F725D | #9CCB8F | Dấu chấm logo, số liệu tích cực, một đường trong biểu đồ Admin |
| `--warn` | #A43C18 | #F0A070 | Chữ cảnh báo (sắp/đã hết hạn, dị ứng) |
| `--warn-bg` | #FBEDE3 | #2E231C | Nền khối/dòng cảnh báo |
| `--track` | #E9E6DC | #2A352F | Nền thanh/vòng tiến độ |
| `--tag-bg` | #E6F1E7 | #1F3A2C | Nền nhãn (chế độ ăn, nhóm) |
| `--border-input` | #C9D0C6 | #3A4740 | Viền ô nhập, nút phụ |
| `--focus-ring` | #DFF184 | #DFF184 | Vòng focus ô nhập (3px) |
| `--dot` | #FF8A52 | #FF8A52 | Chấm thông báo chưa đọc (chỉ chấm, không làm nền chữ) |

Điều chỉnh 31/10/2026 (lượt UI-1, đã duyệt): bản đầu dùng `--action-hover` tối #3A8570 và dùng `--action` cho cả nền lẫn chữ. Ở chế độ tối, chữ trắng trên #3A8570 chỉ đạt 4.40:1, còn #2F725D làm chữ/viền trên nền tối chỉ đạt 2.90:1 (card) và 3.16:1 (nền trang), không đạt quy tắc dưới. Vì vậy: `--action-hover` tối đổi sang #3A8270 (4.56:1, gần như cùng màu) và tách `--action-text` cho chữ/viền (tối #8FC2AE, ≥ 7.3:1). Chế độ sáng không đổi (`--action-text` = `--action`). Ngoài ra có token phụ không phải màu mới: `--shadow-overlay`, `--backdrop` (nền mờ sau hộp thoại). Bảng đo: `docs/design/contrast.md`.

Quy tắc:
- Mọi cặp chữ/nền ≥ 4.5:1 (chữ ≥ 24px hoặc đậm ≥ 19px: ≥ 3:1). Thêm test hoặc ghi bảng đo vào `docs/design/contrast.md`.
- Màu không phải kênh duy nhất truyền ý nghĩa: cảnh báo luôn có chữ ("còn 1 ngày") hoặc icon.
- Màu biểu đồ (Admin, dinh dưỡng): `--action`, `--accent`, `--warn`, `--muted` — tối đa 4 màu, đọc được ở cả hai chế độ.

---

## 5. Chữ
- **Fraunces**: tiêu đề H1–H3, số liệu lớn, logo. **Be Vietnam Pro**: mọi thứ còn lại.
- Tải từ Google Fonts có subset `vietnamese`; dự phòng `"Noto Serif", serif` / `"Noto Sans", sans-serif`. Không bao giờ rơi về Georgia.
- Kiểm bằng Playwright chuỗi "Sống uống ặc ữ ỗ ẫ ợ Đậu hũ" ở mọi độ đậm dùng tới và chữ nghiêng.

| Cấp | Font | Cỡ / line-height / độ đậm | Ghi chú |
|---|---|---|---|
| Hero H1 | Fraunces | 64–72 / 1.05 / 500 | Chỉ ở Tổng quan, Công thức, Landing |
| H1 trang | Fraunces | 40–48 / 1.1 / 500 | Các trang còn lại |
| H2 | Fraunces | 28–32 / 1.15 / 500 | Tên khối |
| H3 | Be Vietnam Pro | 18–20 / 1.35 / 600 | Tên thẻ, tên món trong thẻ |
| Số liệu | Fraunces | 32–48 / 1 / 500, `font-variant-numeric: tabular-nums` | Calo, số lượng |
| Thân | Be Vietnam Pro | 16 / 1.6 / 400 | Đoạn văn tối đa ~70 ký tự/dòng |
| Phụ | Be Vietnam Pro | 14 / 1.5 / 400–500 | Chú thích |
| Nhãn | Be Vietnam Pro | 13 / 1.4 / 600, chữ thường viết hoa đầu câu | Nhãn trường, chip |

- Không line-height < 1.05, không letter-spacing < −1% với chữ tiếng Việt.
- Viết hoa đầu câu (sentence case) cho tiêu đề, nút, nhãn. Không viết hoa toàn bộ.
- Đổi trên mobile: Hero 40–44, H1 32–36, H2 24.

---

## 6. Bố cục
- Lưới 12 cột, nội dung tối đa 1280px, lề 16px (điện thoại) / 24px (tablet) / 32px (máy tính).
- Spacing bội số 4: 4, 8, 12, 16, 24, 32, 48, 64, 96. Giữa các khối lớn: 48–64px; trong khối: 16–24px.
- Căn trái mặc định. Căn giữa chỉ cho trạng thái trống và trang Đăng nhập.
- Breakpoint: 640 / 1024 / 1200.
- Trang công cụ (Kho, Thực đơn, Admin): không ảnh hero, đầu trang gọn (tiêu đề + 1–2 hành động).
- Trang nội dung (Tổng quan, Công thức, Landing): được dùng ảnh hero.

---

## 7. Thành phần (components/ui/)
| Thành phần | Quy cách |
|---|---|
| Button | Bo tròn, cao 44px (chính 48px). Chính: nền `--action`, chữ trắng. Phụ: viền `--border-input`. Nguy hiểm: chữ `--warn`, viền `--warn`. Chữ là động từ cụ thể ("Lưu vào kho", không "Gửi"). Tối đa 1 nút chính mỗi vùng |
| IconButton | 44×44, bắt buộc `aria-label` |
| Field | Nhãn ở trên, ô cao 48px, bo 12px; focus viền `--action-text` + vòng `--focus-ring` 3px; lỗi hiện ngay dưới, chữ `--warn`, nói rõ cách sửa |
| Chip (lọc) | Cao 40–44px, bo tròn; chọn: nền `--action` chữ trắng; có số đếm thật nếu hữu ích |
| Tag (nhãn) | Nền `--tag-bg`, chữ `--ink`, 13px, không in hoa |
| Card | Nền `--surface`, viền 1px `--line`, bo 16px, **không bóng**. Không lồng card trong card |
| Overlay (menu thả, hộp thoại, toast) | Bóng `0 12px 32px rgba(21,72,60,.12)` (tối: `rgba(0,0,0,.4)`), bo 16px |
| ConfirmDialog | Thay mọi `window.confirm`. Tiêu đề nêu rõ hành động + đối tượng ("Xóa thực đơn Tuần 44?"), nêu hậu quả, nút nguy hiểm ghi đúng hành động ("Xóa thực đơn") |
| Bảng | Hàng ≥ 52px, nhãn cột 13px, cột thao tác 44px; ≤ 760px chuyển thành thẻ |
| Trạng thái | Loading: skeleton đúng hình nội dung. Empty: 1 câu nói điều gì đang trống + 1 nút hành động. Error: nền `--warn-bg`, nói điều gì sai + "Thử lại"; không xin lỗi, không mơ hồ |
| Toast | Xác nhận hành động bằng đúng động từ của nút ("Đã lưu vào kho") |
| Focus | Bàn phím: outline 2px `--action-text`, offset 3px, ở mọi phần tử tương tác. Không `outline:none` trơn |

---

## 8. Chuyển động
- 160ms ease-out cho hover/nhấn/mở; hộp thoại 200ms.
- Chỉ chuyển động khi người dùng tác động (mở, đóng, đánh dấu, lưu). Không hiệu ứng khi cuộn, không animation tự chạy lặp.
- Được phép **một** khoảnh khắc chủ đích: vòng calo chạy tới giá trị khi tải Tổng quan.
- GSAP chỉ giữ nếu phục vụ đúng một khoảnh khắc đó; còn lại bỏ.
- `prefers-reduced-motion`: tắt mọi chuyển động không cần thiết.

---

## 9. Giọng văn và từ vựng
- Xưng "bạn", câu ngắn, động từ rõ, không cảm thán, không "tuyệt vời/thông minh/hành trình".
- Nói bằng dữ liệu thật của người dùng: "Còn 2 món sắp hết hạn", "Bạn đã có 5/7 nguyên liệu".
- Một hành động giữ một tên trong toàn bộ luồng (nút "Đánh dấu đã ăn" → toast "Đã đánh dấu đã ăn").
- Không trộn tiếng Anh trong nhãn: "Ít tinh bột", "Giàu đạm", "Ăn lành mạnh" (không "Low Carb", "Healthy").
- Từ vựng thống nhất:

| Dùng | Không dùng |
|---|---|
| Kho thực phẩm / Tủ bếp (tiêu đề) | Pantry, kho đồ |
| Thực đơn | Meal plan, kế hoạch ăn |
| Công thức, món | Recipe |
| Hạn sử dụng, còn N ngày | Expiry, HSD (trừ cột bảng hẹp) |
| Đã ăn | Hoàn thành, completed |
| Đã mua | Purchased |
| Quét hóa đơn | OCR, scan |
| Món đã ngừng sử dụng | Ẩn, hidden |

---

## 10. Ảnh
- Ảnh món Việt thật, cùng phong cách (ánh sáng tự nhiên ấm, nền gỗ/vải/men sứ, không nền trắng studio, không ảnh AI). Nguồn: tự chụp / Unsplash / Pexels, ghi nguồn trong `docs/design/image-sources.md`.
- Tỉ lệ: thẻ 4:3, ảnh nhỏ 1:1. Hero Tổng quan: ảnh tràn phải ~58% chiều ngang, cao theo khối chữ. Hero Landing: 4:3 trong cột phải. Thẻ món lớn chiếm 2 cột ở Landing: 16:9. `object-fit: cover`.
- Hiển thị qua `optimizedImageUrl` (Cloudinary f_auto, q_auto, giới hạn chiều rộng). Có `alt` mô tả món.
- Chưa có ảnh: ô màu `--surface-2` + tên món (thẻ, danh sách; ảnh nhỏ: chữ cái đầu), không dùng ảnh minh họa khác món. Ngoại lệ: hero (Tổng quan, Landing) chỉ hiện khi món có ảnh thật, chưa có thì chỉ có chữ; thẻ món ở Landing chưa có ảnh thì chỉ có chữ, không vẽ ô, để trang giới thiệu không thành lưới ô xám.
- Chỉ ảnh đã tải lên Cloudinary mới là "ảnh thật"; ảnh nhóm `/assets/recipe-*.jpg` của dữ liệu mẫu không hiển thị (gây sai món).

---

## 11. Khả năng truy cập (bắt buộc)
- Tương phản theo mục 4; vùng bấm ≥ 44px; mọi chức năng dùng được bằng bàn phím; thứ tự Tab hợp lý.
- Ô nhập có `<label>`; lỗi liên kết `aria-describedby`; hộp thoại khóa focus và đóng bằng Esc.
- Icon trang trí `aria-hidden`; icon chức năng có `aria-label`.
- `lang="vi"`.

---

## 12. Responsive
- Kiểm ở 390, 768, 1366, 1920px, cả hai chế độ màu. Không cuộn ngang ở 320px.
- ≤ 1200px: liên kết menu thu vào nút menu. ≤ 1024px: lưới 2 cột → 1 cột; hero Tổng quan: ảnh thành nền phía sau chữ, phủ lớp `--bg` 86% (vẫn đạt tương phản); hero Landing: ảnh xếp dưới chữ. ≤ 760px: bảng → thẻ (bảng Admin: ≤ 1023px, vì bảng Công thức có 8 cột).
- Trên điện thoại, hành động chính của trang nằm trong tầm ngón cái (đầu nội dung hoặc thanh dưới).

---

## 13. Khung chung
**Menu trên** (đồng bộ trang chủ 11/11/2026; sticky, cao 68px, nền `--bg`, kẻ dưới 1px):
- Trái: logo chiếc bát `NouriWordmark` (components/ui, Fraunces 600, màu `--home-ink`; cùng logo trang chủ). `Logo` cũ chỉ còn ở Đăng nhập (Admin dùng `NouriWordmark` + nhãn "Quản trị").
- Chính giữa thanh (lưới `1fr auto 1fr`, cột hai bên tối thiểu bằng nội dung): liên kết chữ phẳng 15px, bo 8px, nền `--home-soft` khi rê chuột; đang chọn: chữ `--action-text` 600 trên nền `--home-soft`. ≤ 1200px thu vào nút menu.
- Phải (sát mép phải): nút chế độ tối (aria-pressed), chuông có chấm `--dot`, nút tài khoản (avatar + tên) mở menu: Hồ sơ, Quản trị (chỉ ADMIN), Đăng xuất. Nút biểu tượng và nút tài khoản không viền, nền `--home-soft` khi rê chuột/mở.

**Footer** (đồng bộ footer trang chủ 11/11/2026): nền xanh rừng `--home-forest-deep` (giống nhau ở chế độ sáng/tối), gọn một hàng: cột thương hiệu (logo ngà, "Ăn ngon hơn. Sống khỏe hơn.", 1 câu mô tả, "© 2026 Nouri · Đồ án tốt nghiệp" nhỏ) + nhóm liên kết **chỉ gồm trang có thật**. Bỏ FooterBotanical. Liên kết chưa có trang (/privacy, /terms, Tin tức, mạng xã hội): làm trang tĩnh ngắn hoặc bỏ.

---

## 14. Từng trang — cấu trúc và tiêu chí đạt

### Tổng quan (mockup: TongQuan7s; làm lại 11/11/2026 lượt 2: "báo ẩm thực mỗi ngày", không lặp hero trang chủ)
- Đầu trang kiểu trang bìa: dòng ngày (`todayLabel`, chữ hoa màu chính) + lời chào; H1 Fraunces "Hôm nay nấu gì?"; mục "Món của hôm nay · n/N" kẻ trên mảnh: tên món Fraunces, lý do gợi ý (dữ liệu thật), thời gian, calo, 2 nút (Xem công thức / Đổi món khác; chưa có món thì "Tạo thực đơn"). Bên phải: ảnh lớn **khung hình lá** (hai góc đối bo 200px) với mảng `--home-soft` lệch phía sau. Món có ảnh thật (`Recipe.imageUrl` Cloudinary) thì hiện ảnh món, alt là tên món; chưa có thì ảnh bàn ăn dự phòng (`hero-table`, alt rỗng, chỉ trang trí — ngoại lệ có chủ đích của mục 10). "Đổi món khác": ảnh cũ nằm dưới, ảnh mới hiện dần 250ms; ảnh các món gợi ý được tải trước (`DashboardHeroImage`).
- Dải số liệu (`todayFigures`): Bữa đã ăn hôm nay (n/m; chưa có thực đơn thì ghi chữ), Thực phẩm trong kho (kho trống: nút "+ Thêm thực phẩm đầu tiên" tới `/pantry` thay cho số 0), Sắp hết hạn trong 7 ngày, Đã hết hạn (màu `--warn` khi > 0); kẻ trên đậm, kẻ dưới và ngăn dọc mảnh, không thẻ; bốn ô cùng padding trong.
- Khung: `--content-max` (tokens.css) là khung chung của mọi trang trong ứng dụng, thanh menu và footer: 1280px, ≥ 1600px 1400px, ≥ 1920px 1440px; lề `--gutter` (16 / 24 từ 640px / 32 từ 1024px). Logo, menu, avatar và lề nội dung trùng vị trí trên mọi trang.
- Hôm nay (7 : 5): Thực đơn hôm nay (dòng thời gian kẻ mảnh, tên món Fraunces, bữa tiếp theo trên nền `--surface-2` kèm nút "Đã ăn", dải Hoàn tác) | cột phụ nền `--surface-2`: Dinh dưỡng hôm nay (vòng calo + 3 thanh) và Nước hôm nay (chưa lưu DB, GĐ5).
- Tủ bếp: dải xanh rừng thương hiệu; "Cần dùng sớm" như các cột báo (số ngày còn lại chữ hoa, ≤ 2 ngày màu `--home-gold`; tên Fraunces; mở `/pantry?item=`), cảnh báo đồ đã hết hạn `--home-alert`, Thêm thực phẩm / Quét hóa đơn.
- Gợi ý cho bạn: thẻ dùng chung đều nhau (không thẻ lớn vì món đầu đã ở đầu trang), không viền, nền dịu + ô tìm công thức.
- Đạt khi: số calo khớp tổng các bữa đã ăn; không còn hero lá/chanh; mobile: ảnh dưới chữ, số liệu 2 × 2, nút "Đã ăn" bấm được bằng ngón cái.

### Công thức (mockup: CongThuc7s)
- Hero + ô tìm kiếm → chip danh mục (tiếng Việt, có số món thật) + Bộ lọc → Dành cho bạn (1 thẻ lớn + 2 thẻ nhỏ: API gợi ý trả 3 món; thẻ lớn có "Có trong kho / Còn thiếu / % mục tiêu calo") → Tất cả công thức (lưới/danh sách, sắp xếp, phân trang).
- Không làm "Nấu từ tủ bếp" (cần API so khớp kho theo danh sách; "Dành cho bạn" đã ưu tiên món dùng đồ trong kho) và "Theo chủ đề" (trùng chip danh mục). Nút yêu thích ẩn tới GĐ5 (lưu DB).
- Đạt khi: không còn nhãn tiếng Anh; thẻ món không dùng chuỗi chấm giữa; số món mỗi chip khớp API.

### Chi tiết công thức (chưa có mockup)
- Trên: ảnh lớn + tên (H1) + mô tả 1–2 câu + hàng thông số (thời gian, khẩu phần, calo) dạng nhãn có tên, không nối chấm.
- Cảnh báo theo hồ sơ (dị ứng/không thích/không hợp chế độ ăn) ngay dưới phần tên — nền `--warn-bg`.
- Hai cột ≥ 1024px: trái = nguyên liệu (chỉnh khẩu phần) + các bước (đánh số vì là trình tự); phải (sticky) = "Dành cho bạn" (có trong kho x/y, còn thiếu, % calo) + hành động (Thêm vào thực đơn, Chia sẻ lên cộng đồng).
- Món đã ngừng sử dụng: thông báo rõ, ẩn hành động.
- Đạt khi: cảnh báo dị ứng thấy được không cần cuộn trên điện thoại.

### Kho thực phẩm (mockup: Kho7s, KhoThem7s)
- Đầu trang gọn: H1 "Tủ bếp của bạn" + tìm kiếm + Thêm thực phẩm ("Quét hóa đơn" ở GĐ3c).
- 4 ô thống kê bấm để lọc (Tất cả / Sắp hết hạn / Đã hết hạn / Dưới mức tối thiểu).
- Bảng: tên + nhóm (thực phẩm không có ảnh), số lượng (cảnh báo dưới tối thiểu), hạn + "còn N ngày", nơi bảo quản, tình trạng, Sửa (icon bút) / Xóa (thùng rác). Dòng sắp hết hạn tô `--warn-bg`; nút "Gợi ý món" trên dòng làm ở GĐ3b. Có thêm dạng lưới.
- Cột phải: Cần dùng sớm, Nấu gì từ kho?
- Hộp thoại Thêm/Sửa: đúng các trường PantryItemForm (kể cả Ghi chú, mockup không có), nơi bảo quản là nút chọn 3 phần, ô ngày dd/mm/yyyy. Bấm nền không đóng hộp thoại (tránh mất dữ liệu đang nhập); Esc và "Hủy" đóng.
- Bỏ "Tiết kiệm ước tính" (số tự đặt) và "Mẹo bảo quản" (câu chung chung); ô "Bảo quản lạnh" thay bằng "Dưới mức tối thiểu".
- Đạt khi: link `?item=` vẫn làm nổi bật đúng dòng; điện thoại hiển thị thẻ, không cuộn ngang.

### Thực đơn (chưa có mockup)
- Đầu trang: H1 tên thực đơn + chọn thực đơn + Tạo thực đơn (nhãn theo nguồn thật: "Tạo bởi AI" / "Thuật toán gợi ý") + Xóa (ConfirmDialog).
- Thanh chọn ngày (7 ngày, ngày hôm nay nổi bật) → các bữa của ngày (ảnh, tên món link sang chi tiết, calo, nút "Đã ăn").
- Cột phải / dưới: Tổng dinh dưỡng ngày so với mục tiêu (chỉ tiêu lấy từ hồ sơ; chưa có hồ sơ thì nhắc tạo hồ sơ); Danh sách đi chợ (nhóm theo loại, cả dòng là vùng bấm "Đã mua"). Nhóm hiện đoán theo tên nguyên liệu tới khi backend điền `ShoppingItem.category` (GĐ3b). "Thêm món" làm ở GĐ5.
- Đạt khi: đổi ngày không tải lại trang; danh sách đi chợ dùng được một tay trên điện thoại.

### Cộng đồng (chưa có mockup)
- Cột chính: ô đăng bài (chữ, tối đa 4 ảnh, gắn công thức) → bảng tin. Thẻ bài: tác giả + thời gian, chữ, ảnh (1 ảnh to; 2–4 ảnh lưới), thẻ công thức đính kèm, hành động Thích / Bình luận / Chia sẻ, menu "…" chỉ trên bài của mình (Xóa bài). "Lưu bài", "Theo dõi", thành viên/chủ đề nổi bật làm ở GĐ5 khi có dữ liệu thật.
- Cột phải (≥1024px): hướng dẫn ngắn cách đăng món kèm công thức. Không "thành viên nổi bật" giả.
- Đạt khi: hàng nút ô đăng bài không vỡ ở 320–390px; ảnh dùng optimizedImageUrl.

### Trợ lý AI (chưa có mockup)
- Khung chat chiếm chính; tin của người dùng căn phải nền `--surface-2`, của trợ lý căn trái nền `--surface` viền `--line`. Ô nhập cố định dưới, nút Gửi.
- Cột phải: ngữ cảnh đang dùng (hồ sơ, kho, thực đơn) để người dùng hiểu câu trả lời dựa trên gì; gợi ý câu hỏi cụ thể.
- Khi chưa có OpenAI key: thông báo rõ đang dùng câu trả lời mẫu.
- Đạt khi: vào trang không bị cuộn cả trang; thời gian tin nhắn là thật.

### Hồ sơ (chưa có mockup)
- Form chia nhóm có tiêu đề: Thông tin cơ bản, Mục tiêu, Chế độ ăn & dị ứng, Khẩu vị. Kết quả chỉ tiêu dinh dưỡng hiện bên cạnh (≥1024px), cập nhật sau khi lưu.
- Một nút "Lưu hồ sơ" ở cuối form (không dính khi cuộn, để không che trường), kèm dòng "Có thay đổi chưa lưu"; dị ứng, món không thích, ẩm thực nhập dạng thẻ.

### Đăng nhập / Đăng ký (bản thiết kế đã duyệt 10/11/2026: "nouri-login-handoff")
- Chia đôi: ảnh món ăn trái (11fr ≈ 55%, slogan Fraunces "Hôm nay ăn gì cho khỏe?" trên lớp tối `--login-scrim`), form phải nền
  `--login-forest`; màu riêng `--login-*` (forest #173F32, gold #F6DFA6, ivory #FAF8F2), giống nhau ở chế độ sáng và tối, không có
  nút đổi chế độ. Fraunces cho tiêu đề/slogan, Be Vietnam Pro cho nội dung. ≤ 1023px ảnh lên trên 300px, ≤ 640px 176px.
- Tinh chỉnh 10/11: logo cùng cỡ trang chủ (`ui-logo` 1.75rem, dấu chấm vàng trên nền tối); tiêu đề Fraunces 400; ô nhập và nút cao
  52px, bo 10px (không pill); focus là outline vàng tách khỏi ô; autofill giữ nền ngà (`:-webkit-autofill`, `:autofill`); lỗi viền 2px +
  chữ dưới ô; điều khoản ở chân cột form sau đường kẻ mảnh; một cột (≤ 1023px) form nằm ngay dưới logo.
- Không hiện nút Google/Apple/Microsoft và "Quên mật khẩu?" của bản thiết kế (chưa có luồng). Mã: `pages/LoginPage.tsx`,
  `components/auth/AuthForm.tsx`, `styles/ui/auth.css`; ảnh `public/assets/login/`.
- (Bản cũ, trước 10/11, giữ để tra:)
- Hai cột ≥1024px: trái form, phải khối `--surface-2` với một câu giới thiệu cụ thể về Nouri (thay bằng ảnh món thật khi có). Điện thoại: chỉ form.
- Checkbox "Nhớ đăng nhập" giữ hành vi hiện có. Lỗi nói rõ ("Email hoặc mật khẩu chưa đúng").

### Admin (tách khu riêng 11/11/2026)
- Điều hướng: ADMIN đăng nhập xong vào thẳng `/admin` (giữ `next` nếu là trang Admin hoặc `/recipes/:id`); ADMIN mở trang người dùng → `/admin`, trừ xem trước công thức `/recipes/:id` (dải "Về trang quản trị" dưới menu). USER mở `/admin` → Tổng quan. Hàm thuần `postLoginPath`, `adminRedirect` (`features/layout/layout.logic.ts`, có test).
- Khung riêng `AdminLayout` (không menu trên/footer của người dùng): ≥ 1024px menu trái 264px — logo chiếc bát + nhãn "Quản trị", Tổng quan / Công thức / Người dùng / Kiểm duyệt / Nhật ký (`ADMIN_NAV`, liên kết kiểu `.site-nav__link`), cuối menu: chế độ tối, tài khoản admin, Đăng xuất. < 1024px: thanh trên (logo + nút menu) mở menu dạng ngăn kéo. Không có chuông thông báo.
- Kiểu trang theo trang người dùng: tiêu đề lớn Fraunces, khung bảng/biểu đồ/bài viết bo 24px, ô lọc dạng viên. Trang công cụ: không ảnh, mật độ thông tin cao nhưng gọn.
- Tổng quan: 4 số tổng (có chú thích: "trong đó 1 bị khóa") thành dải ngăn bằng đường mảnh, ghi "không tính tài khoản mẫu minh họa" + biểu đồ 12 tuần (Recharts, màu token, có nhãn trục, đọc được ở chế độ tối).
- Bảng có tìm kiếm, lọc, phân trang. Công thức: form tạo/sửa có upload ảnh (xem trước), báo lỗi nhãn chay theo từng nguyên liệu. Người dùng: Khóa/Mở khóa. Kiểm duyệt: xem bài + xóa. Nhật ký: thời gian, người thực hiện, hành động, đối tượng.
- Mọi thao tác xóa/khóa dùng ConfirmDialog. Test kiểm kê `features/admin/admin-controls.test.ts`: mọi nút/hộp thoại Admin phải còn.

### Landing
- **Làm lại 10/11/2026** (thay các ý dưới): màu thương hiệu `--home-*` (forest #173F32, gold #F6DFA6, ivory #FAF8F2, sage #A8BDA5; có bản
  tối), chỉ Be Vietnam Pro, logo đậm không nghiêng. Header riêng (neo + Đăng nhập/Đăng ký), hero nền xanh với ảnh món (cùng ảnh trang
  đăng nhập) và thẻ một món thật từ `/featured` chồng lên góc [thay 10/11: hero "bàn ăn trong vòm" — nền ngà, mảng xanh rừng từ giữa cột ảnh tràn mép phải; một ảnh bàn
  ăn thật (nhiều bữa) trong khung vòm vắt qua ranh giới hai màu; mockup màn Thực đơn (HTML/CSS, dải 7 ngày + 3 bữa có thật trong bộ 33 món + tổng calo,
  `HeroMealPlanMockup`) đè chân vòm nối với cột chữ; không dãy số liệu, không ảnh trang trí; nút phụ "Xem cách hoạt động"; cao vừa một
  màn hình, chữ thẳng lề logo; ≤ 1023px: chữ trên, vòm giữa, mảng xanh nửa dưới; ảnh do người dùng cung cấp, xem
  `public/assets/home/NGUON.txt`]; 5 chức năng (Kho là khối lớn, kèm quét hóa đơn); món thật + số theo nhóm
  từ `/stats`; 4 bước; Cộng đồng; dải mời cuối; footer riêng nền xanh. Khách bấm trang cần đăng nhập → `/login?next=…` (`landingLink`).
- Menu bản cho khách (logo, liên kết neo tới các phần, chế độ tối, Đăng nhập) + footer chung.
- Hero: một câu nói rõ Nouri làm gì + "Đăng ký miễn phí" / "Đăng nhập"; ảnh món thật nếu có (`GET /api/recipes/featured`), chưa có thì chỉ chữ.
- Các phần, mỗi phần một ý: Nouri giúp gì (3 việc, không icon) → Món trong Nouri (số thật từ `/api/recipes/stats`, 6 món từ `/featured`; khách bấm món thì sang đăng nhập rồi mở đúng món) → Cách hoạt động (4 bước đánh số: kho → hồ sơ → thực đơn → đi chợ) → Cộng đồng (chỉ mô tả) → lời kêu gọi đăng ký.
- Không blob/lá/kính mờ, không GSAP, không hiệu ứng khi cuộn, không số minh họa.

---

## 15. Nghiệm thu mỗi lượt UI (Claude Code tự làm trước khi báo xong)
1. Chụp Playwright trước/sau ở 390 và 1440px, **cả sáng và tối**; lưu vào `docs/design/screens/<lượt>/`.
2. Đi qua checklist mục 3 cho từng trang đã làm, ghi kết quả vào báo cáo (bảng tổng hợp cuối đợt: `docs/design/nghiem-thu-ui.md`).
3. Kiểm tương phản các cặp màu mới dùng; kiểm Tab qua toàn trang; không cuộn ngang ở 320px.
4. Kiểm chữ tiếng Việt có dấu chồng hiển thị đúng ở tiêu đề.
5. Không còn mã màu cứng trong CSS mới; CSS cũ của trang đã gỡ.
6. `npm test`, typecheck, build đều đạt; chức năng cũ của trang vẫn chạy (đi lại luồng chính).
7. Liệt kê chỗ nào lệch so với mockup và lý do.

---

## 16. Chỗ lệch đã chấp nhận (UI-3 → UI-11)
Các điểm đã ghi vào mục 3–14 ở trên; tóm tắt để tra nhanh. Việc còn thiếu do chưa có chức năng sẽ làm ở giai đoạn ghi trong ngoặc.

| Trang | Khác với bản đầu / mockup | Lý do |
|---|---|---|
| Mọi trang | Bỏ cụm chữ nghiêng màu accent ở H1 (UI-12) | Dấu hiệu "template"; chữ nghiêng chỉ còn ở logo |
| Tổng quan | Chưa có "Quét hóa đơn" (GĐ3c), "Thêm vào thực đơn" (GĐ5); nước chưa lưu DB (GĐ5) | Chức năng chưa có |
| Công thức | "Dành cho bạn" 1 lớn + 2 nhỏ; bỏ "Nấu từ tủ bếp", "Theo chủ đề"; ẩn yêu thích (GĐ5) | API gợi ý trả 3 món; tránh chép logic so khớp kho ở frontend; trùng chip |
| Kho | Không ảnh thực phẩm; "Gợi ý món" trên dòng (GĐ3b); "Quét hóa đơn" (GĐ3c); có Ghi chú; bấm nền không đóng hộp thoại | Dữ liệu không có ảnh; chức năng chưa có; giữ đủ trường; tránh mất dữ liệu |
| Thực đơn | Nhóm đi chợ đoán theo tên (tới GĐ3b) | Backend chưa điền `category` |
| Cộng đồng | Không Lưu bài/Theo dõi/thành viên nổi bật (GĐ5) | Trước đây chỉ là state giả |
| Hồ sơ | Nút lưu không dính | Thanh dính che trường cuối trên điện thoại |
| Đăng nhập | ~~Cột phải là khối chữ, chưa có ảnh~~ → làm theo bản thiết kế đã duyệt 10/11 (mục 14); ẩn nút OAuth và "Quên mật khẩu?"; giữ dòng điều khoản; gradient duy nhất `--login-scrim` (lớp tối để slogan đọc được) | Chưa có OAuth/quên mật khẩu; lớp tối là chức năng, không trang trí |
| Admin | Bảng thành thẻ từ ≤ 1023px (không phải 760px) | Bảng Công thức 8 cột tràn khung ở 768px |
| Landing | Hero 4:3; ≤ 1024px ảnh xếp dưới chữ; thẻ chưa có ảnh chỉ có chữ | Cân với cột chữ; không phủ lớp mờ lên ảnh; tránh lưới ô xám |
