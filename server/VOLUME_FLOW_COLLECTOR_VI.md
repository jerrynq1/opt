# Gexadecimal — Persistent Option Chain + Volume Flow (local test)

## Mục tiêu

Node.js gateway là nơi duy nhất kết nối Binance để thu thập GLD/QQQ. Gateway đồng bộ expiry inventory, tải toàn bộ hợp đồng/quote của từng expiry, lưu snapshot vào SQLite và nhận các thay đổi liên tục từ Binance Equity Option WebSocket. Website/indicator chỉ đọc dữ liệu đã lưu qua API Node; trình duyệt không gọi endpoint Option Chain của Binance và không mở Option Chain WebSocket.

ETF Options Volume Flow chỉ tạo bubble từ **Volume Delta**. Không dùng OI làm bubble, không giả lập heatmap limit/stop, và không gán BUY/SELL nếu không có trade print + quote phù hợp.

## Cách hoạt động

1. Khi `home-proxy.mjs` khởi động, collector tìm danh sách expiry bằng cách hợp nhất Exchange Info và trang Options chính thức của Binance. Tối đa 512 expiry cho mỗi underlying (giới hạn an toàn; tổng tối đa 1.024 streams cho GLD + QQQ).
2. Server tải contract symbols và quote cho từng expiry; lưu toàn bộ contract snapshot gồm strike, C/P, Volume, OI, Bid/Ask/Mid, IV, Greeks và các trường Binance trả về vào SQLite.
3. Server subscribe Binance Equity Option `@optionChainQuoteDelayed` stream cho toàn bộ expiry đã tìm được. Payload được đưa vào hàng đợi theo contract; scanner flush hàng đợi tối đa mỗi 1 giây và merge vào SQLite.
4. Song song, scanner REST chạy theo vòng luân phiên: **mỗi tick 1 giây chỉ truy vấn một expiry**, không tải đồng thời toàn bộ chain của tất cả expiry. Snapshot của expiry đó được so sánh với SQLite; chỉ contract có field thực sự đổi mới được ghi. Các field không có trong payload mới được giữ nguyên.
5. Khi Volume tăng, Volume Delta được ghi vào `volume_events`; khi Volume không đổi thì không tạo event. Volume giảm/reset hoặc sang phiên New York mới chỉ lập baseline mới, không tạo Delta âm.
6. Nếu một snapshot REST đang tải mà WebSocket update mới cho cùng contract tới, scanner bỏ qua contract đó trong REST merge và flush bản WebSocket sau để tránh ghi đè dữ liệu mới hơn bằng snapshot cũ.
7. Danh sách expiry được khám phá lại mỗi 15 phút (mặc định). Expiry mới được hydrate vào SQLite; expiry đã cache không bị tải lại toàn bộ khi chỉ refresh inventory.
8. Website Option Chain, QuantLab GEX và ETF Options Volume Flow đọc API Node/SQLite. Website có thể đọc lại cache theo chu kỳ để cập nhật màn hình, nhưng không tải Option Chain trực tiếp từ Binance.

**Về tần suất:** `VOLUME_COLLECTOR_SCAN_INTERVAL_MS` mặc định 1000 ms. Mỗi tick xử lý một expiry theo vòng luân phiên và ghi riêng contract thay đổi. WebSocket push là kênh live chính; REST scanner là cơ chế đối chiếu/fallback theo từng expiry, không phải một API delta-only. Nếu có 1.024 expiry, một vòng REST sweep lý thuyết mất khoảng 1.024 giây, cộng thời gian upstream; khi lỗi/429 scanner tự backoff tối đa 30 giây. Cách này tránh tải lại tất cả expiry trong cùng một giây.

## Chạy trên máy nhà

- Yêu cầu Node.js 22 trở lên (global WebSocket và `node:sqlite`).
- Dừng task Node Gateway cũ trước khi chạy source này.
- Từ thư mục project, chạy: `node server/home-proxy.mjs`.
- Collector tự khởi động cùng gateway; không cần mở website.
- SQLite mặc định: `server/data/gexadecimal-volume-flow.sqlite`.
- Không đặt `DISABLE_VOLUME_COLLECTOR=1` khi muốn chạy collector thật.

Ví dụ PowerShell:

```powershell
$env:VOLUME_COLLECTOR_EXPIRIES = "512"
$env:VOLUME_COLLECTOR_UNIVERSE_REFRESH_MS = "900000"
$env:VOLUME_COLLECTOR_SCAN_INTERVAL_MS = "1000"
node server/home-proxy.mjs
```

Biến môi trường:

- `VOLUME_COLLECTOR_EXPIRIES`: tối đa số expiry cho mỗi mã, mặc định 512 (giới hạn an toàn 512).
- `VOLUME_COLLECTOR_UNIVERSE_REFRESH_MS`: chu kỳ khám phá lại expiry, mặc định 900000 ms (15 phút).
- `VOLUME_COLLECTOR_SCAN_INTERVAL_MS`: chu kỳ scanner, mặc định 1000 ms. Mỗi tick REST-check một expiry và flush WebSocket updates đang chờ.
- `VOLUME_COLLECTOR_RECONNECT_MIN_MS`: reconnect ban đầu, mặc định 1 giây.
- `VOLUME_COLLECTOR_RECONNECT_MAX_MS`: reconnect tối đa, mặc định 30 giây.
- `VOLUME_FLOW_DB_PATH`: đường dẫn SQLite dùng chung cho option-chain cache và volume events; mặc định `server/data/gexadecimal-volume-flow.sqlite`.

## API chỉ đọc cho website

- `GET /api/options-cache/status`: số expiry/contracts đã lưu và tình trạng collector.
- `GET /api/options-cache/expiries?symbol=GLD`: danh sách expiry đã lưu, số contract và trạng thái `ready`.
- `GET /api/options-cache/chain?symbol=GLD&expiry=2026-11-27`: full chain snapshot đã lưu trong SQLite.
- `GET /api/volume-flow/status`: trạng thái Volume collector và số event.
- `GET /api/volume-flow/events?symbol=GLD&limit=20000`: lịch sử Volume Delta cho mọi expiry của GLD.
- `GET /api/volume-flow/contracts?symbol=GLD`: cumulative Volume mới nhất theo contract.

Các API này là read-only GET; chúng không kích hoạt Binance fetch từ trình duyệt.

## Bubble / ETF Options Volume Flow

- Trục X: timestamp server phát hiện Volume thay đổi.
- Trục Y: strike được quy đổi sang NAS100 hoặc XAUUSD bằng tỷ lệ Spot hiện tại.
- Call bubble: xanh; Put bubble: đỏ. Màu là loại contract, không phải Buyer/Seller.
- Kích thước bubble tỷ lệ với Volume Delta; nhãn in strike + C/P + Delta.
- Dấu `~` biểu thị Delta được nhận sau khoảng gián đoạn; không thể xác định chính xác từng giây trong khoảng đó.
- Đã bỏ heatmap khỏi ETF Options Volume Flow vì nguồn hiện tại không có historical order book/limit/stop data.
- Event là Volume Delta tích lũy giữa hai lần quan sát, không phải từng trade print riêng lẻ.

## Lưu ý dữ liệu

- Baseline đầu tiên không được vẽ thành bubble; chỉ Volume tăng sau baseline mới tạo event.
- Volume là hợp đồng đã khớp tích lũy. Chỉ từ Volume không thể kết luận aggressor BUY/SELL hoặc xác định đó là mở hay đóng vị thế.
- Binance hiện không cung cấp delta-only REST endpoint trong đường gọi của project. Mỗi REST scanner tick lấy snapshot của một expiry theo vòng luân phiên, rồi chỉ ghi các contract có field khác. Đây là snapshot compare, không phải yêu cầu upstream chỉ trả về changed contracts.
- Nếu Binance không gửi payload cho một expiry/contract, database giữ snapshot gần nhất và status cho biết thời điểm cập nhật.
- Stream hiện dùng `@optionChainQuoteDelayed`; độ trễ và trường dữ liệu phụ thuộc Binance.
- Môi trường build có thể chạy unit/integration tests nhưng không chứng minh được Binance stream thực tế từ IP nhà người dùng. Cần xác minh `messages_received` trong phiên giao dịch.

## Kiểm thử build

- Focused suite cho Option Chain cache, Volume Flow collector/API, browser cache-only loading và ETF Flow bubble: **97/97 tests pass**.
- `node --check` đã pass cho các module server và frontend được chỉnh sửa.
- Full project suite hiện **212/216 tests pass**; 4 lỗi còn lại là test cũ/asset gốc thiếu và một kiểm tra WebSocket proxy bên ngoài, được ghi chi tiết trong `VOLUME_FLOW_CHANGE_REPORT.md`.
