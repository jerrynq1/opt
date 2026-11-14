# ICT QuantLab — Tick / Footprint / Depth Audit (15/11/2026)

## Loại feed thực tế

- cTrader `GetTickData (2145)` trả BID/ASK quote ticks; live stream cũng là Bid/Ask quote update. Không có executed trade size, transaction ID/count hay verified aggressor side. Vì vậy quote event không đồng nghĩa một giao dịch đã khớp.
- `FPM/BTE` trong QuantLab là quote-footprint map được dựng từ thay đổi bid/ask/mid và gán về price level. Các metric dựa trên đó là `quote_tick_proxy`, không phải exchange volume-at-price.
- cTrader DOM là Level II depth quotes. Có thể đọc bid/ask levels và các thay đổi quote entry; không phải MBO (mỗi lệnh riêng biệt), không phải trade tape.
- cTrader bar `volume` trên CFD được dùng như bar volume/tick-volume field; không được mặc định là centralized traded size.

## Quote-tick / quote-footprint indicators còn giữ

Catalog hiện giữ 20 indicator có `status=ported_tick`; 23 runtime keys được đăng ký vì một số module có tuỳ chọn OHLCV mặc định nhưng chỉ cần tick khi người dùng bật một mode/filter cụ thể. Các catalog tick rows gồm:

| ATAS class | QuantLab key | Nguồn / giới hạn |
|---|---|---|
| AskBidBars | `atas_ask_bid_bars_tick` | Bid quote events trừ ask quote events |
| AverageDelta | `atas_average_delta_tick` | Average của quote delta |
| BidAsk | `atas_bid_ask_tick` | Bid/Ask quote events theo side |
| BidAskVR | `atas_bid_ask_ratio_tick` | Ratio của quote events, không phải traded volume ratio |
| CandleStatistics | `atas_candle_stats_tick` | Quote count/delta theo bar |
| ClusterSearch | `atas_cluster_search_quote_fp` | Cluster trên quote-footprint profile |
| CumulativeDelta | `atas_cvd_quote_tick` | Cumulative quote delta, không phải trade CVD |
| DeltaColoredCandles | `atas_delta_candles_tick` | Candle colors theo quote delta |
| DeltaStrength | `atas_delta_strength_tick` | Chuẩn hóa quote delta |
| DeltaTurnaround | `atas_delta_turnaround_tick` | Quote delta reversal heuristic |
| DynamicLevels | `atas_dynamic_levels_footprint` | POC/VA levels theo quote-event price profile |
| DynamicLevelsChannel | `atas_dynamic_channel_footprint` | Channel của quote profile |
| Exhaustion | `atas_exhaustion_footprint` | Quote activity heuristic tại biên, không phải trade exhaustion |
| ImbalanceRatio | `atas_imbalance_footprint` | Imbalance giữa quote events ở price levels |
| MaxLevels | `atas_max_levels_footprint` | Level có quote-event count lớn nhất |
| SpeedOfTape | `atas_speed_tape_tick` | Tốc độ quote updates, không phải trade tape speed |
| SpreadVolume | `atas_spread_volume_tick` | Spread weighted bởi quote events |
| StackedImbalance | `atas_stacked_imbalance_quote_fp` | Stacked quote imbalance, không phải executed volume imbalance |
| Ratio | `atas_ratio_quote_fp` | Bid/ask quote events ở adjacent levels cùng symbol |
| UnfinishedAuctionMod | `atas_unfinished_auction_fp` | Quote events tại high/low; proxy, không xác nhận auction bằng trades |

`BarVolumeFilter`, `BarsPattern` và `VHF` là OHLCV-capable entries; chỉ kích hoạt tick loader khi chọn nguồn/filter liên quan đến quote ticks. Chúng không được tính vào 20 catalog `ported_tick` rows. `Cluster Statistic` là module QuantLab có sẵn và cũng tiêu thụ quote-footprint.

## Level II depth indicators còn giữ

- `DomPower` → `atas_dom_power_l2`: tổng bid/ask size top-N từ cTrader Level II snapshot; chỉ là snapshot hiện tại.
- `OrderBookAlerts` → `atas_order_book_alerts_l2`: cảnh báo threshold trên size/price offset trong depth snapshot và quote changes; không tạo lịch sử depth giả.

Hai mục trên không tuyên bố là MBO. `DOM Strength` và `MBO DOM` bị loại vì source ATAS cần CumulativeTrades/MBO stream và renderer chuyên biệt.

## Các tính toán được giữ bằng OHLCV/session

CAV, FCV, VSA Better Volume, VSA-WSD, Weis Wave và các technical/candle/volume indicators được port từ chart bars, không yêu cầu trade tape riêng. Session levels dùng server-time axis QuantLab, configurable start time, không có exchange holiday/roll calendar. Open Line default 09:00; Daily Change default previous close; Pivots dùng ATAS HighLow formula; Initial Balance từ chối output khi timeframe thô hơn IB window.

## Không thể thay thế bằng quote tick/depth

- Executed trade prints, cumulative trades, true aggressor volume: Active Volume, Market Power/CVD pro, Multi Market Powers, Order Flow Indicator, Tape Patterns, Volume Per Trade và các trade-sequence tools bị loại.
- Open Interest: Open Interest, OI Analyzer, On Balance OI, Herrick Payoff bị loại.
- Market breadth/external/multi-symbol: McClellan, COT, Synthetic VIX, External Charts và các external data tools bị loại.
- Account/portfolio: Account Info, Margin Zones, Trades on Chart bị loại.
- MBO/render-only: MBO DOM, DOM Strength, custom chart paint/overlay-only utilities bị loại nếu app không có dữ liệu hoặc renderer tương ứng.
- `HRanges` bị loại trong audit cuối: ATAS `HRanges.cs` lấy `GetAllPriceLevels()` và tích lũy actual volume-at-price trong range. Quote-footprint count của QuantLab không thể thay thế dữ liệu đó một cách đúng đắn, vì vậy không giữ một bản proxy mang tên indicator gốc.

## Runtime / kiểm thử

- Tick collector chỉ hoạt động khi có consumer bật; các mode OHLCV không tự mở tick loader.
- Missing quote/depth data trả unavailable/null, không zero-fill.
- Historical footprint giữ giới hạn `FP_MAXD` hiện có.
- Tests là static/unit/fixture checks; chưa xác minh live trên browser/cTrader user account.
