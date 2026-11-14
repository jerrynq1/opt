# ICT QuantLab · ATAS Indicator Library (VI)

## Kết quả đối chiếu source ATAS

Gói nguồn có 285 file C# và 254 khai báo indicator class có `DisplayName`. Sau audit: **217 mục được giữ trong catalog**, mỗi mục có một file `.js` riêng và implementation/adapter đang dùng được với dữ liệu hiện có; **37 mục bị loại khỏi catalog/UI** vì thiếu feed/renderer cần thiết hoặc trùng với module ICT hiện hữu. Danh sách và lý do nằm trong `REMOVED_INDICATORS_VI.md`.
Chi tiết kiểm toán cuối cùng, số lượng theo loại port, nguồn dữ liệu và giới hạn triển khai nằm trong `FINAL_RESOURCE_AUDIT_VI.md`.

## Cấu trúc

- `atas-catalog.json` / `atas-catalog.js`: catalog chỉ giữ các indicator có implementation dùng được với dữ liệu/renderer hiện tại.
- `atas-technical-runtime.js`: helper OHLCV.
- `atas-session-runtime.js`: gom session/day/week/month theo trục thời gian server mà chart cung cấp; không có exchange holiday calendar riêng.
- `atas-tick-runtime.js`: collector quote-tick/footprint proxy; không phải trade tape.
- `individual/<id>.js`: mỗi indicator trong catalog có một file JavaScript riêng.
- `_compat_*.js`: compatibility modules cũ, không phải catalog entries.
- `atas-registry-finalize.js`: xác minh registry sau khi tất cả modules đã nạp.

## Nguồn dữ liệu được tận dụng

1. **OHLCV chart bars** từ cTrader chart: các công thức technical, candle, volatility, volume-bar, session levels. `volume` trên CFD có thể là broker tick volume, không được mặc định coi là centralized executed volume.
2. **Historical/live BID/ASK quote ticks**: `GetTickData (2145)` và live quote updates; footprint phân loại mỗi quote update thành quote event theo quy tắc của collector. Không có executed size, trade ID hoặc aggressor side đã xác minh.
3. **cTrader Level II depth quotes**: snapshot bid/ask levels và thay đổi quote entries từ depth stream. Đây là market-depth quote data, không phải MBO từng lệnh hay executed-trade feed.
4. **Server-time axis** (`A.s`/`A.t`) của chart: session/day/week/month aggregation có thể cấu hình giờ mở; không có holiday/rollover calendar theo exchange.

## Phân loại implementation

- `direct`: công thức/logic được port theo source C# hoặc định nghĩa kỹ thuật trực tiếp.
- `approx_proxy`: có phép tính chạy được nhưng khác biệt dữ liệu, hành vi renderer hoặc chi tiết triển khai ATAS; xem `detail` trong catalog.
- `quote_tick_proxy`: sử dụng quote events/quote footprint; tuyệt đối không diễn giải thành traded volume hay true order-flow delta.
- `existing_module`: liên kết implementation QuantLab đã có từ trước.

Một indicator xuất hiện trong catalog đồng nghĩa có implementation chạy được bằng nguồn hiện có, nhưng không có nghĩa tất cả đều parity 1:1 với ATAS. Indicator cần feed/renderer không có sẽ bị loại khỏi catalog/UI, danh sách nằm ở `REMOVED_INDICATORS_VI.md`.

## Tick / footprint

Chỉ các module đang bật có nhu cầu quote-tick mới kích hoạt historical/live footprint collector. Bar's Volume Filter chỉ yêu cầu quote feed ở các mode tick/delta/bid/ask; Bars Pattern chỉ yêu cầu khi bật filter footprint; VHF chỉ yêu cầu ở source ticks/bid/ask. Các mode dùng OHLCV không gọi tick loader.

Mọi quote-derived output được label rõ trong catalog và mô tả indicator. Khi feed thiếu, output là null/unavailable; không zero-fill dữ liệu giả. Historical footprint giữ giới hạn `FP_MAXD` hiện hữu trong source; không tự thay đổi backend hoặc cấu hình server.

## Session / DOM

- Daily Change mặc định so với Previous Day Close.
- Pivots mặc định dùng ATAS `HighLow` third formula: R3/S3 = PP ± 2 × (High − Low).
- Open Line mặc định dùng custom server-session start 09:00 theo source ATAS; có thể chỉnh giờ/phút.
- Initial Balance chỉ vẽ khi timeframe chart không lớn hơn cửa sổ IB; timeframe rộng hơn không đủ thông tin để xác định extrema đầu phiên nên indicator trả rỗng.
- DOM Power và Order Book Alerts dùng cTrader Level II depth snapshot/event changes. Chúng chỉ hiển thị snapshot/current depth; không tạo lịch sử DOM giả và không gọi dữ liệu đó là MBO.

## Thứ tự nạp và deploy

`atas-catalog.js` → OHLCV/session/tick runtimes → primary individual modules → aliases/compatibility modules → registry finalizer → `js/indicators-engine.js`. Service Worker cache version được bump mỗi khi shell asset thay đổi. Thay đổi trong bản audit này chỉ thuộc frontend; không yêu cầu restart Node/Worker/Tunnel.

## Kiểm thử

`bash tests/run-all.sh` chạy unit/fixture/static wiring tests. Đây không phải live validation trên browser và tài khoản cTrader thực tế. Xem `TICK_DATA_AUDIT_VI.md` và `REMOVED_INDICATORS_VI.md` để biết giới hạn dữ liệu và mục đã loại.
