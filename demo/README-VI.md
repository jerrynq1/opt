# ETF Options Volume Flow — Bubble Preview

`volume-flow-bubble-preview.html` là bản preview tĩnh dùng dữ liệu giả để minh họa cách ETF Options Volume Flow in bubble trên chart NAS100.

## Quy tắc hiển thị

- Trục X: thời gian server quan sát được Volume Delta.
- Trục Y: strike ETF quy đổi sang giá chart đích bằng `Target Spot × (Option Strike / ETF Spot)`.
- Call: bubble xanh; Put: bubble đỏ.
- Bán kính bubble tăng theo căn bậc hai của Volume Delta, có giới hạn để bubble không che toàn bộ chart.
- Chữ trong bubble là C/P; nhãn cạnh bubble in strike, loại option và Volume Delta.
- Bubble chỉ biểu diễn lượng Volume mới phát hiện giữa hai lần quan sát, không nhận diện BUY/SELL, không phải trade print riêng lẻ.

## Dữ liệu mô phỏng

QQQ Spot = 600; NAS100 Spot = 21,000. Ví dụ strike 602 được đặt tại mức NAS100 `21,000 × 602 / 600 = 21,070`.

Toàn bộ candles, Spot và Volume Events trong ảnh là dữ liệu tự tạo; không phải market data thật.

Mở file HTML trực tiếp trong trình duyệt để xem bản mô phỏng. Ảnh PNG cùng thư mục là screenshot tham chiếu.
