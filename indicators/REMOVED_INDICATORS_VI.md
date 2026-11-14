# Indicator đã loại khỏi thư viện (15/11/2026)

Các mục sau bị loại khỏi catalog/UI vì cần nguồn dữ liệu hoặc renderer không có trong source hiện tại, hoặc trùng key với module tổng hợp. File `.cs` gốc vẫn còn trong gói ATAS gốc người dùng đã cung cấp.

- `Account Info Display` (`AccountInfoDisplay`): Cần nguồn ngoài, nhiều symbol hoặc trạng thái tài khoản/portfolio.
- `Active Volume` (`ActiveVolume`): Dùng số quote events theo mức giá như volume proxy. ATAS gốc dùng cumulative trades và traded size thật; cTrader quote ticks không chứa khối lượng khớp lệnh.
- `Background Picture` (`Logo`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `Bar Numbering` (`BarNumbering`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `Bar Timer` (`BarTimer`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `Color Bar HH/LL` (`ColorBarHighLow`): Chỉ tô màu nến theo High/Low pattern; cần candle renderer/candle-color API riêng.
- `Color Bar Open/Close` (`ColorBarOpenClose`): Chỉ tô màu nến theo Open/Close; cần candle renderer/candle-color API riêng.
- `COT High/Low` (`CotHigh`): Cần nguồn ngoài, nhiều symbol hoặc trạng thái tài khoản/portfolio.
- `Current price` (`CurrentPrice`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `Custom View` (`SampleCustomViewIndicator`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `CVD pro / Market Power` (`MarketPower`): Cumulative quote delta và EMA signal; khác với signed trade-volume market power.
- `DOM Strength` (`DomStrength`): Source ATAS yêu cầu cả MarketDepth và CumulativeTrades; cTrader Level II có depth quotes nhưng không có executed cumulative trades, nên không thể tái tạo tín hiệu đúng.
- `External Chart` (`ExternalCharts`): Cần nguồn ngoài, nhiều symbol hoặc trạng thái tài khoản/portfolio.
- `Fair Value Gap` (`FairValueGap`): Được đưa qua module ICT hiện có (nhóm ICT 2022); module gộp nhiều cấu phần, không phải bản ATAS độc lập 1:1.
- `Herrick Payoff Index` (`HerrickPayoff`): ATAS formula reads candle Open Interest (OI) alongside price. Current cTrader BID/ASK GetTickData stream does not expose OI; requires a genuine OI feed.
- `HRanges` (`HRanges`): Source C# dùng `GetAllPriceLevels()` để cộng actual volume-at-price trong range. Quote-footprint count hiện có không thể thay thế traded volume-at-price đúng nghĩa, nên đã loại thay vì giữ bản proxy gây hiểu nhầm.
- `Margin zones` (`MarginZones`): Cần account/portfolio margin state của broker, không có trong OHLCV chart.
- `MBO DOM` (`MainIndicator`): ATAS MBO DOM đăng ký market-by-order, market depth và trade events, sau đó dựng lưới trực quan riêng. Cần feed full depth/MBO và renderer chuyên biệt; DOM module hiện tại không thể thay thế chính xác.
- `McClellan Oscillator` (`McClellanOscillator`): McClellan Oscillator cần market breadth advances/declines, không thể suy từ một symbol.
- `McClellan Summation Index` (`MSI`): McClellan Summation Index cần market breadth advances/declines, không thể suy từ một symbol.
- `CVD pro(multi) / Multi Market Powers` (`MultiMarketPower`): Source gọi `RequestForCumulativeTrades` và xử lý `CumulativeTrade`/`OnUpdateCumulativeTrade`; connector hiện chỉ có BID/ASK quote ticks và không có executed cumulative trades hoặc signed trade size.
- `Mutual Fund Bars` (`MutualFundBars`): Cần nguồn ngoài, nhiều symbol hoặc trạng thái tài khoản/portfolio.
- `OHLC Plus` (`OHLCPlus`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `OI Analyzer` (`OIAnalyzer`): ATAS requests CumulativeTrades and reads OpenInterest from trade ticks. The current connector only retrieves BID/ASK quote ticks; no verified trade/OI tick feed.
- `On Balance Open Interest` (`BalanceOI`): ATAS uses candle.OI to calculate signed/cumulative open interest. This is an OI series, not BID/ASK quote ticks; requires provider OI data.
- `Open Interest` (`OpenInterest`): ATAS uses candle OI, MaxOI and MinOI fields. Current cTrader BID/ASK quote tick endpoint does not expose these OI fields.
- `Order Block` (`OrderBlock`): Được đưa qua module ICT hiện có (nhóm ICT 2022); module gộp nhiều cấu phần, không phải bản ATAS độc lập 1:1.
- `Order Flow Indicator` (`OrderFlow`): Đánh dấu các chuỗi quote updates cùng chiều; không phải individual trade prints hoặc lệnh lớn thật.
- `Properties` (`SampleProperties`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `Rollover Dates` (`RolloverDates`): Cần lịch phiên/timezone và định nghĩa session khớp với ATAS; bản OHLCV hiện tại chỉ có thể dùng mốc server/UTC nếu chưa cấu hình riêng.
- `Session Color` (`SessionColor`): Cần lịch phiên/timezone và định nghĩa session khớp với ATAS; bản OHLCV hiện tại chỉ có thể dùng mốc server/UTC nếu chưa cấu hình riêng.
- `Synthetic VIX` (`SyntheticVix`): Cần nguồn ngoài, nhiều symbol hoặc trạng thái tài khoản/portfolio.
- `Tape Patterns` (`TapePattern`): Phát hiện pattern trên quote-run sequence thay vì actual trade sequence.
- `Trades On Chart` (`TradesOnChart`): ATAS source là lịch sử/vị thế giao dịch trên tài khoản người dùng. Đây không phải market tick indicator; hiện connector không expose account trade history cho indicator này.
- `Volume Per Trade` (`VolumePerTrade`): Source tính `candle.Volume / candle.Ticks`; chart cTrader hiện có OHLCV/tick-volume nhưng không cung cấp hai trường executed volume và trade count độc lập có cùng ngữ nghĩa ATAS. Không thay bằng quote-event count.
- `Vertical Grid` (`VerticalGrid`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.
- `Watermark` (`Watermark`): Chủ yếu là UI/overlay tiện ích riêng của ATAS, không phải phép tính series tiêu chuẩn.

Các mục `Active Volume`, `CVD pro / Market Power`, `Order Flow Indicator`, `Tape Patterns` và `Volume Per Trade` bị loại vì source ATAS cần CumulativeTrades/trade prints hoặc genuine trade count; quote updates không thay thế executed trade feed. `HRanges` cũng bị loại vì cần actual volume-at-price. `Fair Value Gap` và `Order Block` được loại khỏi danh sách ATAS riêng do cùng trỏ vào key `ict22`; tính năng ICT 2022 tổng hợp của QuantLab vẫn được giữ trong app.
## Đối chiếu source bundle

Gói `ATAS-Indicators-Develop.zip` chứa 285 file C#; quét các khai báo `[DisplayName]` gắn với class cho ra 254 indicator source classes duy nhất. Catalog giữ 217 mục có thể triển khai bằng dữ liệu/renderer QuantLab hiện có; 37 mục được liệt kê ở trên bị loại khỏi catalog/UI. Hai tính năng Fair Value Gap và Order Block vẫn có module ICT 2022 của QuantLab, nhưng không được nhân đôi thành hai bản ATAS riêng vì cùng key tổng hợp. Tổng 217 + 37 = 254; không còn source class nào bị bỏ sót trong danh sách kiểm kê.
