/* ================= INDICATOR CỦA BẠN (chỗ để thử indicator mới) =================
   File này nạp SAU indicators-defs.js và TRƯỚC indicators-engine.js, nên chỉ cần gán thêm vào IND là indicator xuất hiện trong mục "Indicator" (Kho indicator).
   Sửa file rồi tải lại trang (Ctrl+F5) là thấy.

   Cấu trúc một indicator (xem thêm các indicator có sẵn trong indicators-defs.js):
     key:{
       n:"Tên hiển thị",  t:"ov" (vẽ đè lên nến) | "osc" (có pane riêng bên dưới),  d:"Mô tả ngắn",
       p:[[khóa,nhãn,mặc định,kiểu, {min,max,step,o,...}], ...]   kiểu: "n" số | "i" số nguyên | "s" chọn (o:[...]) | "b" bật/tắt
       c:[màu mặc định, ...]   L:[tên từng ô màu, ...]   ("@up"/"@dn" = theo màu nến tăng/giảm)
       hl:[{y:0,al:.5}]        đường ngang tham chiếu (tuỳ chọn)
       f:(A,p,E)=>[series]     tính toán: trả về mảng series
     }
   A = dữ liệu nến đã gom theo khung giờ đang xem: A.t thời gian hiển thị, A.s giờ server (giây), A.o/A.h/A.l/A.c giá, A.v khối lượng (mỗi mảng cùng độ dài).
   p = giá trị thông số hiện tại. Phần tử chưa đủ dữ liệu trả null.
   series: {k:"l", d:[...], ci:0}  đường (ci = chỉ số ô màu trong c)
           {k:"h", d:[...], ci}    cột histogram
           {k:"f", d:[{top,bottom}|null,...], ci, al:.1}  vùng tô giữa 2 đường
   Hàm tiện ích dùng được ngay: sma, ema, rma, wma, sdv (độ lệch chuẩn), trg (true range), rsiOf, srcOf(A,"close"|"hl2"|...), P_(n) (làm tròn chu kỳ >= 1), L1(d) (1 đường). */

IND.mine={
  n:"My Indicator (mẫu)",t:"osc",
  d:"Mẫu: chênh lệch giữa giá đóng cửa và SMA. Sửa hàm f bên dưới để thử ý tưởng của bạn.",
  p:[["period","Chu kỳ",20,"i",{min:1}]],
  c:["#35b6ff"],L:["Close - SMA"],hl:[{y:0,al:.5}],
  f:(A,p)=>{
    const m=sma(A.c,P_(p.period));
    return L1(A.c.map((v,i)=>m[i]==null?null:v-m[i]));
  }
};

/* ===== HVN Profile: vùng volume dày (High Volume Node) theo từng chu kỳ, kéo sang phải đến khi giá chạm lại =====
   Kiểu "of" nên không đi qua hàm f; phần tính + vẽ nằm ở js/hvn-profile.js. ver:2 = làm lại, cài đặt cũ đã lưu sẽ về mặc định mới. */
IND.hvn={
  n:"HVN Profile",t:"of",ver:2,
  d:"Tìm các node volume dày (High Volume Node) trong từng chu kỳ (1 phút đến Tuần), kèm POC, % volume và độ mạnh, tách hỗ trợ/kháng cự, rồi kéo sang phải đến khi giá chạm lại (hoặc nhảy qua) thì đóng vùng, phân loại giữ/phá và có thể báo. Dùng tick thật khi có, không thì ước lượng từ nến M1.",
  p:[["tf","Chu kỳ profile","3600","s",{g:"Profile",o:[["60","1 phút"],["300","5 phút"],["900","15 phút"],["1800","30 phút"],["3600","1 giờ"],["14400","4 giờ"],["86400","Ngày"],["604800","Tuần"]],tt:"Mỗi chu kỳ dựng một profile riêng. Intraday hay dùng 30 phút, swing hay dùng Ngày."}],
     ["src","Nguồn volume","auto","s",{o:[["auto","Tự động (tick nếu có)"],["m1","Chỉ nến M1"]],tt:"Tự động: nếu đã tải tick (bật Footprint, Big Trade hoặc Statistic) thì phân bổ volume theo tick thật, không thì theo đường đi của giá trong nến M1."}],
     ["rows","Số hàng giá mỗi profile",100,"i",{min:20,max:400,tt:"Nhiều hàng thì chi tiết hơn nhưng nhiễu hơn. Kích thước hàng tự làm tròn theo bước giá của mã."}],
     ["hw","Bề rộng histogram (% chu kỳ)",50,"i",{min:5,max:100}],
     ["meth","Cách nhận diện","peak","s",{g:"Nhận diện HVN",o:[["peak","Đỉnh nổi bật (khuyên dùng)"],["level","Theo ngưỡng"]],hp:["Hai cách nhận diện","Đỉnh nổi bật: tìm các đỉnh volume của profile đã làm mượt, giữ đỉnh đủ cao và đủ nổi bật so với thung lũng quanh nó. Biên vùng dừng ở thung lũng giữa 2 đỉnh nên các node kề nhau được tách riêng.","Theo ngưỡng: mọi hàng có volume từ ngưỡng % của đỉnh lớn nhất trở lên đều là HVN, các hàng gần nhau gộp thành cụm. Đơn giản hơn nhưng dễ dính các node kề nhau thành một."]}],
     ["thr","Ngưỡng biên vùng (% đỉnh)",60,"i",{min:10,max:95,tt:"Đỉnh nổi bật: vùng mở rộng từ đỉnh đến khi volume tụt dưới ngưỡng này (hoặc gặp thung lũng). Theo ngưỡng: so với đỉnh lớn nhất của cả profile. Thấp hơn thì vùng rộng hơn."}],
     ["prom","Độ nổi bật tối thiểu (% đỉnh lớn nhất)",15,"i",{min:0,max:90,on:p=>p.meth!=="level",tt:"Đỉnh phải cao hơn thung lũng quanh nó ít nhất chừng này so với đỉnh lớn nhất, để loại các gợn nhỏ trên sườn."}],
     ["smooth","Số lần làm mượt",2,"i",{min:0,max:10,tt:"Làm mượt trung bình 3 điểm, lặp lại. Nhiều lần thì các đỉnh răng cưa dính thành một cao nguyên."}],
     ["gapr","Khoảng trống cho phép trong cụm (hàng)",1,"i",{min:0,max:10,on:p=>p.meth==="level"}],
     ["minr","Kích thước vùng tối thiểu (hàng)",2,"i",{min:1,max:50}],
     ["mins","Volume tối thiểu của vùng (% profile)",3,"n",{g:"Lọc chất lượng",min:0,max:100,step:0.5,tt:"Vùng có volume nhỏ hơn chừng này % tổng volume của profile thì bỏ. Dùng để loại vùng yếu."}],
     ["mpv","Bỏ chu kỳ volume thấp (% so với trung vị)",30,"i",{min:0,max:100,tt:"Chu kỳ có tổng volume thấp hơn chừng này % so với trung vị các chu kỳ đã đóng (nghỉ lễ, phiên mỏng) thì không vẽ. 0 = tắt."}],
     ["touch","Khi nào vùng bị dùng hết","edge","s",{g:"Kéo dài vùng",o:[["edge","Giá chạm mép vùng"],["poc","Giá chạm POC"],["close","Nến đóng cửa vào hoặc vượt vùng"]],tt:"Giá nhảy qua vùng (gap) luôn tính là đã dùng hết. Chế độ đóng cửa chỉ xét nến đã đóng nên không bị tính nhầm vì râu nến."}],
     ["grace","Số nến bỏ qua trước khi tính chạm",1,"i",{min:0,max:50,tt:"Bỏ qua chừng này nến đầu tiên sau khi chu kỳ kết thúc rồi mới xét chạm vùng."}],
     ["pocx","Kéo dài POC cùng vùng",true,"b"],
     ["shwt","Hiện vùng đã bị chạm (cắt tại nến chạm)",true,"b",{tt:"Vùng bị phá (nến đóng cửa xuyên qua) mờ hơn và POC nét đứt; vùng giữ (bật lại) mờ vừa."}],
     ["sdc","Màu theo hỗ trợ / kháng cự",true,"b",{g:"Hiển thị",tt:"Vùng dưới giá đóng cuối chu kỳ là hỗ trợ, vùng trên là kháng cự (đổi màu ở tab Kiểu dáng)."}],
     ["cfl","Hiện số vùng chồng nhau (×N)",true,"b"],
     ["live","Hiện profile đang chạy",true,"b"],
     ["lop","Độ mờ profile đang chạy",0.3,"n",{min:0.05,max:1,step:0.05}],
     ["zop","Độ mờ vùng HVN",0.14,"n",{min:0.02,max:1,step:0.02,tt:"Vùng mạnh hơn (volume lớn hơn) đậm hơn."}],
     ["hop","Độ mờ histogram",0.5,"n",{min:0.05,max:1,step:0.05}],
     ["maxb","Số nến quét ngược tối đa",3000,"i",{min:100,max:20000,tt:"Giới hạn để chart nhẹ. Tối đa 400 chu kỳ gần nhất được vẽ."}],
     ["alert","Báo khi giá chạm vùng HVN",false,"b",{g:"Cảnh báo",tt:"Hiện thông báo trên thanh trạng thái và phát tiếng bíp khi nến đang chạy chạm vào một vùng HVN còn hiệu lực."}]],
  c:["#35b6ff","#ffb02e","#98a2d8","#b388ff","#26c882","#ff5c8a"],L:["Vùng HVN (trung tính)","POC","Histogram","Profile đang chạy","Hỗ trợ (dưới giá)","Kháng cự (trên giá)"],
  lab:p=>tfName(+p.tf),f:()=>[]
};

/* ===== Heavy Absorption v2: lệnh lớn bị thanh khoản thụ động hấp thụ (giá bị chặn), ngưỡng thích nghi theo thống kê =====
   Kiểu "of": phần tính + vẽ nằm ở js/orderflow-absorption.js. Dùng tick (footprint) nên tự tải tick khi bật. */
const HAB_ON=(k,v)=>p=>p[k]===v,HAB_NOT=(k,v)=>p=>p[k]!==v;
IND.hab={
  n:"Heavy Absorption",t:"of",ver:2,
  d:"Tìm các lệnh mua/bán lớn bất thường tại một mức giá trong nến (volume Ask hoặc Bid vượt ngưỡng thống kê thích nghi trong lookback) và kiểm tra giá có thực sự bị chặn hay không: phía mua bị hấp thụ khi giá không đi tiếp qua mép trên cụm, phía bán ở mép dưới. Sau đó theo dõi vài nến để xác nhận hoặc đánh dấu thất bại. Mỗi marker là một vòng tròn, số bên trong là volume. Kết hợp HVN Profile: viền marker nằm trong vùng HVN còn hiệu lực, biết vùng là hỗ trợ hay kháng cự và marker có đúng vai trò không. Với CFD là số ước lượng từ chuỗi báo giá bid/ask.",
  p:[["step","Bước giá (0 = tự động)",0,"n",{g:"Dữ liệu",mn:1,min:0,step:0.01,tt:"Gộp volume theo hàng giá có bề rộng này. 0 = tự động theo trung vị biên độ nến chia số hàng bên dưới (làm tròn 1/2/5)."}],
     ["rows","Số hàng giá mỗi nến (khi tự động)",12,"i",{min:3,max:60,on:p=>!(+p.step>0),tt:"Nhiều hàng thì print nhỏ hơn và chi tiết hơn, ngưỡng cũng thấp hơn. 10 đến 20 là hợp lý."}],
     ["cov","Bỏ nến thiếu tick (độ phủ tối thiểu %)",60,"i",{min:0,max:100,tt:"Nến có ít hơn chừng này % số phút có dữ liệu tick (lịch sử tick bị cắt, mới bật) thì không tham gia thống kê và không có marker, tránh ngưỡng sai vì thiếu dữ liệu."}],
     ["sens","Độ nhạy","normal","s",{g:"Ngưỡng lệnh lớn",mn:1,o:[["low","Thấp (ít marker, mạnh)"],["normal","Vừa"],["high","Cao (nhiều marker)"],["custom","Tuỳ chỉnh hệ số"]],tt:"Thấp ≈ k 3, Vừa ≈ 2, Cao ≈ 1.5 (chế độ log: 3 / 2.5 / 2)."}],
     ["sdk","Hệ số k",2,"n",{mn:1,min:0.5,max:6,step:0.1,on:HAB_ON("sens","custom"),tt:"Ngưỡng = trung bình + k × độ lệch chuẩn. Cao hơn thì ít marker hơn và mạnh hơn."}],
     ["dist","Cách tính ngưỡng","sd","s",{o:[["sd","Trung bình + k·độ lệch chuẩn (như ATAS)"],["log","Theo log volume (ổn định hơn)"]],hp:["Hai cách tính ngưỡng","Trung bình + k·độ lệch chuẩn: đúng mô tả của Heavy Absorption gốc. Volume từng mức giá lệch phải và đuôi dài nên vài print cực lớn kéo độ lệch chuẩn lên, làm các print lớn vừa bị bỏ sót.","Theo log volume: tính trung bình và độ lệch chuẩn trên ln(volume) rồi đổi ngược lại. Phù hợp phân phối đuôi dài, ngưỡng ổn định hơn qua các phiên, bắt được cả lệnh lớn vừa."]}],
     ["lb","Lookback (số nến)",100,"i",{mn:1,min:5,max:1000,tt:"Cửa sổ thống kê: ngưỡng tính từ mọi print của chừng này nến gần nhất."}],
     ["minn","Số print tối thiểu trong cửa sổ",30,"i",{min:5,max:5000,tt:"Cửa sổ có ít print hơn mức này thì chưa tính ngưỡng (đầu lịch sử hoặc mới tải tick)."}],
     ["excl","Không tính nến đang xét vào thống kê",true,"b",{tt:"Print lớn của chính nến đang xét không tự nâng trung bình và độ lệch chuẩn, nên nhạy hơn và đúng hơn. Tắt để giống bản gốc (cửa sổ gồm cả nến hiện tại)."}],
     ["minv","Volume tối thiểu (0 = tắt)",0,"i",{min:0,tt:"Ẩn cụm có tổng volume nhỏ hơn mức này (mỗi print cũng phải đạt mức này)."}],
     ["minp","Print tối thiểu (% volume nến, 0 = tắt)",0,"n",{min:0,max:100,step:0.5,tt:"Print phải chiếm ít nhất chừng này % tổng volume của nến, loại các print lớn nhưng chỉ là phần nhỏ của nến volume rất cao."}],
     ["gap","Gộp hàng kề nhau (số hàng trống cho phép)",1,"i",{g:"Hấp thụ",min:0,max:10,tt:"Các print đủ ngưỡng ở hàng kề nhau (cách nhau tối đa chừng này hàng trống) gộp thành một cụm: một marker, volume là tổng cụm."}],
     ["maxm","Tối đa marker mỗi phía mỗi nến",1,"i",{min:1,max:5,tt:"Giữ các cụm có tổng volume lớn nhất."}],
     ["rej","Điều kiện giá bị chặn trong nến","ext","s",{mn:1,o:[["none","Không kiểm tra (chỉ lệnh lớn)"],["ext","Giá không đi quá mức hấp thụ"],["close","Không đi quá và đóng cửa phía bị chặn"]],hp:["Giá bị chặn là gì?","Hấp thụ nghĩa là lệnh lớn đánh vào nhưng giá không đi tiếp. Phía mua bị hấp thụ: đỉnh nến không vượt mép trên của cụm quá số hàng cho phép. Phía bán bị hấp thụ: đáy nến không thấp hơn mép dưới của cụm quá số hàng cho phép.","Chế độ chặt hơn còn yêu cầu nến đóng cửa không vượt mép cụm.","Cụm mà giá chạy xuyên qua ngay trong nến (không bị chặn) bị loại. Chọn \"Không kiểm tra\" để chỉ phát hiện lệnh lớn như bản gốc."]}],
     ["ext","Dung sai vượt mức (hàng)",2,"i",{min:0,max:20,on:HAB_NOT("rej","none"),tt:"Giá được phép vượt mép cụm tối đa chừng này hàng giá vẫn tính là bị chặn. Cũng dùng khi xét các nến xác nhận."}],
     ["conf","Số nến xác nhận",3,"i",{mn:1,min:0,max:30,tt:"Theo dõi chừng này nến sau marker: giá vượt mức hấp thụ thì thất bại, giữ được hết thì xác nhận, chưa đủ nến thì đang chờ (vòng đứt nét). 0 = không xác nhận."}],
     ["cm","Thất bại khi","close","s",{o:[["close","Nến đóng cửa vượt mức"],["wick","Râu nến vượt mức"]],tt:"Đóng cửa: bỏ qua râu nến quét qua rồi quay lại. Râu: chặt hơn, mọi lần chạm vượt đều tính."}],
     ["sts","Hiển thị theo trạng thái","all","s",{o:[["all","Tất cả (thất bại mờ đi)"],["nofail","Ẩn marker thất bại"],["ok","Chỉ marker đã xác nhận"]],tt:"Lưu ý: ẩn thất bại hoặc chỉ hiện xác nhận làm marker xuất hiện hoặc biến mất sau vài nến, vì trạng thái chỉ biết khi các nến sau đã đóng."}],
     ["hvn","Kết hợp HVN Profile","mark","s",{g:"Kết hợp HVN Profile",o:[["off","Không dùng"],["mark","Viền nổi bật khi trong vùng HVN"],["only","Chỉ hiện khi trong vùng HVN"],["align","Chỉ hiện khi trong vùng HVN và đúng vai trò"]],hp:["Kết hợp với HVN Profile","Cần bật cả HVN Profile trên chart. Vùng HVN còn hiệu lực là vùng của chu kỳ đã kết thúc mà giá chưa dùng hết (nến chạm vùng vẫn tính vì đó là phản ứng).","Vai trò theo hướng giá tới: nến mở dưới giữa vùng thì vùng là kháng cự (R), mở trên thì là hỗ trợ (S). Đúng vai trò (viền liền): mua bị hấp thụ tại kháng cự hoặc bán bị hấp thụ tại hỗ trợ. Ngược vai trò: viền đứt nét.","Nhãn POC xuất hiện khi POC của vùng nằm sát cụm. Nếu HVN Profile đang tắt thì mục này không có tác dụng."]}],
     ["htol","Dung sai quanh vùng HVN (hàng)",1,"i",{min:0,max:20,on:HAB_NOT("hvn","off"),tt:"Cụm chỉ cần nằm sát vùng trong chừng này hàng giá là tính là trong vùng."}],
     ["sz","Cỡ vòng tròn theo","thr","s",{g:"Hiển thị",o:[["thr","Số lần ngưỡng (ổn định khi cuộn/zoom)"],["vis","Marker lớn nhất đang hiển thị (như ATAS)"]],tt:"Theo ngưỡng: cỡ phụ thuộc volume so với ngưỡng của nến đó nên không đổi khi cuộn chart. Theo marker lớn nhất: cỡ co giãn theo các marker đang nhìn thấy."}],
     ["cap","Cỡ lớn nhất khi volume gấp (lần ngưỡng)",5,"n",{min:1.5,max:50,step:0.5,on:HAB_ON("sz","thr")}],
     ["dmin","Đường kính nhỏ nhất",14,"i",{min:6,max:80}],["dmax","Đường kính lớn nhất",44,"i",{min:10,max:160}],
     ["op","Độ mờ",0.55,"n",{min:0.1,max:1,step:0.05}],["hol","Rỗng ruột",false,"b"],
     ["txt","Hiện số volume",true,"b"],
     ["tm","Nội dung chữ","vol","s",{o:[["vol","Volume"],["z","Điểm σ (độ mạnh thống kê)"],["both","Volume và σ"]],tt:"σ = print lớn nhất của cụm cách trung bình bao nhiêu độ lệch chuẩn (theo cách tính ngưỡng đang chọn)."}],
     ["tsz","Cỡ chữ",11,"i",{min:7,max:20}],
     ["lvl","Kẻ mức hấp thụ sang phải",true,"b",{tt:"Đường ngang từ marker đến khi giá phá mức (thất bại) hoặc hết số nến tối đa. Có thể dùng làm hỗ trợ/kháng cự ngắn hạn."}],
     ["len","Kéo dài tối đa (nến)",20,"i",{min:1,max:300,on:p=>p.lvl}],
     ["live","Hiện marker nến đang chạy",true,"b",{tt:"Nến đang chạy chưa đóng nên marker có thể đổi hoặc biến mất theo từng tick (vòng đứt nét = đang chờ)."}],
     ["alm","Cảnh báo","off","s",{g:"Cảnh báo",o:[["off","Tắt"],["bar","Khi nến có marker đóng"],["ok","Khi marker được xác nhận"]],tt:"Hiện thông báo trên thanh trạng thái và phát tiếng bíp. Lần mở đầu chỉ ghi nhớ marker cũ, không báo dồn."}]],
  c:["#26c882","#ff5c8a","#ffffff","#ffb02e"],L:["Bull (lệnh mua / Ask)","Bear (lệnh bán / Bid)","Màu chữ","Viền vùng HVN"],lab:p=>(p.sens==="custom"?p.sdk:p.sens==="low"?"thấp":p.sens==="high"?"cao":"vừa")+"/"+p.lb,f:()=>[]
};


/* ===== DOM / MBO: sổ lệnh (Depth of Market) từ cTrader, bảng bên phải chart + histogram thanh khoản ở mép phải =====
   Kiểu "of": phần tính + vẽ nằm ở js/orderflow-dom.js. Dữ liệu là kênh depth của cTrader Open API (mỗi báo giá có ID riêng nên tách được từng lệnh). */
IND.dom={
  n:"DOM / MBO",t:"of",ver:1,
  d:"Sổ lệnh (Depth of Market) lấy từ kênh depth của cTrader: bảng Bid | Giá | Ask | VP nằm bên phải ngoài chart, và histogram thanh khoản dựng ngay mép phải vùng vẽ, thẳng hàng với trục giá. Mỗi báo giá trong sổ có ID riêng nên tách được từng lệnh (MBO), đếm số lệnh mỗi mức, nháy ô khi lệnh được thêm hoặc rút, và tô nổi các mức thanh khoản mạnh bất thường kèm đường ngang sang trái. Với forex/CFD đây là thanh khoản tổng hợp do broker báo, không phải sổ lệnh sàn tập trung.",
  p:[["panel","Hiện bảng DOM bên phải",true,"b",{g:"Bảng DOM",mn:1}],
     ["pw","Bề rộng bảng (px)",250,"i",{min:150,max:500,on:p=>p.panel}],
     ["rh","Chiều cao hàng (px)",18,"i",{min:12,max:36,on:p=>p.panel}],
     ["step","Gộp giá (0 = tự động)",0,"n",{min:0,step:0.01,tt:"Gộp các lệnh vào hàng giá có bề rộng này. 0 = tự động theo spread hiện tại (làm tròn 1/2/5), không nhỏ hơn bước giá của mã."}],
     ["unit","Đơn vị size","lot","s",{o:[["lot","Lot"],["unit","Đơn vị hợp đồng (oz, EUR...)"],["raw","Số thô của cTrader (1/100 đơn vị)"]],tt:"Size trong giao thức cTrader tính theo 1/100 đơn vị. Lot = size / lotSize của mã."}],
     ["vp","Cột VP (volume đã khớp theo giá)",true,"b",{on:p=>p.panel,tt:"Volume đã khớp theo giá trong khoảng thời gian bên dưới, lấy từ tick footprint nên bật cột này sẽ tự tải tick (3 ngày gần nhất)."}],
     ["vpm","VP: số phút gần nhất",240,"i",{min:5,max:4320,on:p=>p.panel&&p.vp}],
     ["ord","Hiện số lệnh mỗi mức (×N)",true,"b",{on:p=>p.panel,tt:"Số lệnh riêng lẻ (ID khác nhau) đang nằm ở mức giá đó."}],
     ["flow","Nháy ô khi lệnh thêm / rút",true,"b",{on:p=>p.panel,tt:"Ô sáng màu Bid/Ask khi size mức đó tăng, màu ngược lại khi giảm trong 1,2 giây gần nhất. Giảm size có thể là rút lệnh hoặc bị khớp, cTrader không phân biệt."}],
     ["edge","Histogram thanh khoản ở mép phải chart",true,"b",{g:"Histogram trên chart",mn:1,tt:"Thanh ngang mỗi mức giá, bám mép phải vùng vẽ: đỏ là Ask phía trên giá, xanh là Bid phía dưới giá."}],
     ["ew","Bề rộng tối đa (% vùng vẽ)",24,"i",{min:5,max:60,on:p=>p.edge}],
     ["mbo","Tách từng lệnh (MBO)",true,"b",{mn:1,on:p=>p.edge,tt:"Mỗi lệnh trong mức giá là một đoạn riêng trong thanh, lệnh lớn nằm sát mép phải."}],
     ["strong","Đánh dấu thanh khoản mạnh",true,"b",{g:"Thanh khoản mạnh",mn:1,tt:"Mức giá có size vượt trung bình + k × độ lệch chuẩn của toàn bộ sổ lệnh được viền nổi, ghi nhãn size và giá."}],
     ["sk","Hệ số k",2,"n",{min:0.5,max:6,step:0.1,on:p=>p.strong,tt:"Cao hơn thì ít mức mạnh hơn."}],
     ["smin","Size tối thiểu để tính là mạnh (0 = tắt)",0,"n",{min:0,step:0.1,on:p=>p.strong,tt:"Tính theo đơn vị size đang chọn ở trên."}],
     ["sline","Kẻ đường ngang từ mức mạnh sang trái",true,"b",{on:p=>p.strong&&p.edge}],
     ["hm","Heatmap lịch sử thanh khoản trên chart",false,"b",{g:"Heatmap (kiểu Bookmap)",mn:1,tt:"Chụp sổ lệnh mỗi giây và tô nền chart theo size từng mức giá theo thời gian: đậm là thanh khoản dày, xanh là Bid, đỏ là Ask. Chỉ có dữ liệu từ lúc bật indicator, mất khi tải lại trang."}],
     ["hmm","Lưu lịch sử (phút)",30,"i",{min:2,max:240,on:p=>p.hm}],
     ["hmr","Độ rộng quanh giá (số hàng mỗi phía)",120,"i",{min:10,max:400,on:p=>p.hm,tt:"Chỉ lưu các mức trong khoảng này quanh giá giữa để nhẹ bộ nhớ."}],
     ["hmo","Độ đậm heatmap",0.5,"n",{min:0.05,max:1,step:0.05,on:p=>p.hm}]],
  c:["#26c882","#ff5c8a","#ffb02e","#35b6ff","#ffd24a"],L:["Bid (mua chờ)","Ask (bán chờ)","Thanh khoản mạnh","Nhấn giá Bid/Ask","VP đã khớp"],
  lab:p=>p.unit==="lot"?"lot":p.unit==="unit"?"đv":"raw",f:()=>[]
};

/* ===== ICT Killzones & Pivots: hộp phiên, pivot High/Low, midpoint, Range Levels, Day/Week/Month, giờ mở cửa, timestamp, bảng hit rate =====
   Port từ Pine Script "ICT Killzones & Pivots [TFO]" (tradeforopp, MPL-2.0). Kiểu "of": phần tính + vẽ nằm ở js/killzones.js.
   Ô nhập kiểu "t" (một dòng) và "ta" (nhiều dòng) do engine hỗ trợ. Màu: 6 killzone, D, W, M, màu mở cửa mặc định, màu timestamp mặc định. */
const KZ_STY=[["Solid","Liền"],["Dotted","Chấm"],["Dashed","Đứt"]],KZ_HIS=[["recent","Chỉ gần nhất"],["limit","Theo giới hạn phiên"],["unl","Không giới hạn"]],KZ_SZ=["Tiny","Small","Normal","Large","Huge"];
const KZ_DEF=[["ASIA","2000-0000",true],["LNDN","0200-0500",true],["NYAM","0930-1100",true],["NYL","1200-1300",false],["NYPM","1330-1600",true],["RTH","0930-1600",false]];
IND.kz={
  n:"Killzones & Pivots",t:"of",ver:1,
  d:"Hộp các phiên giao dịch (Asia, London, NY AM/PM...) theo giờ New York hoặc GMT, pivot cao/thấp của từng phiên kéo sang phải đến khi giá phá, midpoint, Range Levels (open ± k × range trung bình/trung vị/độ lệch chuẩn), Day/Week/Month (open, high/low/mid kỳ trước), giá mở cửa theo giờ, đường timestamp và bảng thống kê hit rate. Port từ Pine Script của tradeforopp.",
  p:[["kzbox","Hiện hộp Killzone",true,"b",{g:"Killzones",mn:1,tt:"Giờ phiên tính theo múi giờ ở mục Toàn cục (mặc định America/New_York)."}],
     ["bxo","Độ mờ hộp",0.15,"n",{min:0.02,max:1,step:0.01,on:p=>p.kzbox}],
     ["maxd","Giới hạn số phiên",3,"i",{min:1,max:200,tt:"Chỉ giữ chừng này bản vẽ gần nhất cho mỗi loại (hộp, pivot, range level, và D/W/M, giờ mở cửa, timestamp khi chọn 'Theo giới hạn phiên')."}],
     ...KZ_DEF.flatMap(([nm,ss,on],i)=>[["u"+(i+1),"KZ"+(i+1)+": bật",on,"b"],["n"+(i+1),"KZ"+(i+1)+": tên",nm,"t",{on:p=>p["u"+(i+1)]}],["s"+(i+1),"KZ"+(i+1)+": phiên (HHMM-HHMM)",ss,"t",{on:p=>p["u"+(i+1)],tt:i===0?"Ví dụ 2000-0000 (qua nửa đêm được). Màu từng killzone đổi ở tab Kiểu dáng.":undefined}]]),
     ["piv","Hiện pivot (High/Low)",true,"b",{g:"Pivots"}],
     ["pst","Kiểu đường pivot","Solid","s",{o:KZ_STY,on:p=>p.piv}],
     ["pw","Độ dày pivot",1,"i",{min:1,max:4,on:p=>p.piv}],
     ["mid","Hiện midpoint",false,"b",{on:p=>p.piv}],
     ["mst","Kiểu đường midpoint","Dotted","s",{o:KZ_STY,on:p=>p.piv&&p.mid}],
     ["mw","Độ dày midpoint",1,"i",{min:1,max:4,on:p=>p.piv&&p.mid}],
     ["lbl","Nhãn pivot",true,"b",{on:p=>p.piv,tt:"Nhãn ghi tên killzone + High/Low."}],
     ["lblr","Vị trí nhãn","r","s",{o:[["r","Cuối đường (phải)"],["l","Đầu đường (trái)"]],on:p=>p.piv&&p.lbl}],
     ["alrt","Báo khi pivot bị phá",true,"b",{on:p=>p.piv,tt:"Hiện thông báo trên thanh trạng thái và phát tiếng bíp khi nến đang chạy phá pivot của phiên gần nhất."}],
     ["ext","Kéo dài pivot","mit","s",{o:[["mit","Đến khi bị phá"],["past","Qua cả điểm bị phá"]],on:p=>p.piv}],
     ["extw","...Của những phiên nào","recent","s",{o:[["recent","Phiên gần nhất"],["all","Tất cả"]],on:p=>p.piv,tt:"Cũng quyết định cửa sổ theo dõi hit rate: pivot được tính trong thống kê chừng nào đường còn được kéo. Phiên gần nhất: đến khi phiên kế của cùng killzone bắt đầu. Tất cả: đến khi bị giới hạn số phiên loại bỏ."}],
     ["tbl","Hiện bảng dữ liệu",true,"b",{g:"Dữ liệu & Range Levels"}],
     ["tpos","Vị trí bảng","Top Right","s",{o:[["Top Left","Trên trái"],["Top Center","Trên giữa"],["Top Right","Trên phải"],["Middle Left","Giữa trái"],["Middle Center","Giữa"],["Middle Right","Giữa phải"],["Bottom Left","Dưới trái"],["Bottom Center","Dưới giữa"],["Bottom Right","Dưới phải"]],on:p=>p.tbl}],
     ["tsz","Cỡ chữ bảng","Small","s",{o:KZ_SZ,on:p=>p.tbl}],
     ["spv","Thống kê Pivot",true,"b",{on:p=>p.tbl,tt:"Hit rate của High/Low từng killzone (cần Hiện pivot). Rê chuột lên ô để xem các lần gần nhất."}],
     ["slv","Thống kê Range Level",true,"b",{on:p=>p.tbl,tt:"Hit rate của từng mức, trên (hàng trên) và dưới (hàng dưới) giá mở cửa (cần Hiện Range Levels)."}],
     ["sdw","Thống kê D/W/M",true,"b",{on:p=>p.tbl,tt:"Hit rate của High/Low ngày/tuần/tháng trước (cần bật High/Low tương ứng)."}],
     ["lbk","Số phiên để đo (lookback)",20,"i",{min:1,max:500,tt:"Dùng để tính range trung bình/trung vị/độ lệch chuẩn và số lần hiện trong tooltip bảng."}],
     ["meas","Cách đo range","Average","s",{o:[["Average","Trung bình"],["Median","Trung vị"],["Standard Deviation","Độ lệch chuẩn"]],tt:"Trung bình và trung vị tính từ range (high-low) từng phiên. Độ lệch chuẩn tính từ độ lệch của giá so với giá mở cửa phiên, lấy mẫu trên mọi nến."}],
     ["lv_on","Hiện Range Levels",false,"b",{tt:"Vẽ các mức trên và dưới giá mở cửa mỗi killzone, bằng hệ số × cách đo range ở trên."}],
     ["lvl","Hệ số, màu (mỗi dòng một mức)","0.25\n0.5\n1.0\n// 1.5\n// 2.0","ta",{rows:5,on:p=>p.lv_on,tt:"Ví dụ '1.5' vẽ mức cách giá mở cửa 1.5 lần số đo range, ở cả hai phía. Màu mặc định theo killzone; ghi đè bằng '1.5, purple' hoặc '1.5, #b388ff'. Dòng bắt đầu bằng // bị bỏ qua."}],
     ["lst","Kiểu đường level","Dotted","s",{o:KZ_STY,on:p=>p.lv_on}],
     ["lw","Độ dày level",1,"i",{min:1,max:4,on:p=>p.lv_on}],
     ["dhist","Lịch sử D/W/M","limit","s",{g:"Ngày - Tuần - Tháng",o:KZ_HIS,tt:"Chỉ gần nhất: chỉ giữ bản vẽ mới nhất mỗi loại. Theo giới hạn phiên: dùng 'Giới hạn số phiên'."}],
     ["dalrt","Báo khi chạm High/Low D/W/M",false,"b"],
     ["dopen","D Open",false,"b"],["dhl","D High/Low",true,"b"],["dmid","D Midline",true,"b",{on:p=>p.dhl}],["dsep","D Divider",false,"b"],
     ["wopen","W Open",false,"b"],["whl","W High/Low",true,"b"],["wmid","W Midline",true,"b",{on:p=>p.whl}],["wsep","W Divider",false,"b"],
     ["mopen","M Open",false,"b"],["mhl","M High/Low",true,"b"],["mmid","M Midline",true,"b",{on:p=>p.mhl}],["msep","M Divider",false,"b"],
     ["hst","Kiểu đường D/W/M","Dotted","s",{o:KZ_STY}],
     ["hw","Độ dày D/W/M",1,"i",{min:1,max:4}],
     ["dow","Nhãn thứ trong tuần",false,"b"],
     ["dowy","Vị trí dọc nhãn thứ","bot","s",{o:[["top","Trên"],["bot","Dưới"]],on:p=>p.dow}],
     ["dowx","Vị trí ngang nhãn thứ","mn","s",{o:[["mn","Nửa đêm"],["mid","Giữa ngày"]],on:p=>p.dow}],
     ["dowh","Ẩn nhãn cuối tuần",true,"b",{on:p=>p.dow}],
     ["opn","Hiện giá mở cửa",true,"b",{g:"Giá mở cửa theo giờ"}],
     ["ohist","Lịch sử giá mở cửa","recent","s",{o:KZ_HIS,on:p=>p.opn}],
     ["otxt","Giờ, màu, nhãn (mỗi dòng một mục)","0930, #35b6ff, NY Open\n1200, #ffb02e, Midday\n1600, #ff5252, Close\n// 0000, yellow, Midnight","ta",{rows:5,on:p=>p.opn,tt:"Giờ dạng HHMM (0930, 930 và 09:30 đều được); màu và nhãn không bắt buộc. Giá lấy từ nến M1 đúng phút đó nên đúng cả khi xem khung lớn hơn M1. Dòng bắt đầu bằng // bị bỏ qua."}],
     ["ost","Kiểu đường giá mở cửa","Dashed","s",{o:KZ_STY,on:p=>p.opn}],
     ["ow","Độ dày giá mở cửa",1,"i",{min:1,max:4,on:p=>p.opn}],
     ["tsh","Hiện timestamp",true,"b",{g:"Timestamp (đường dọc)"}],
     ["thist","Lịch sử timestamp","recent","s",{o:KZ_HIS,on:p=>p.tsh}],
     ["ttxt","Giờ, màu (mỗi dòng một mục)","0930, #26c882\n1200, #ffb02e\n1600, #ff5252\n// 0000, yellow","ta",{rows:4,on:p=>p.tsh}],
     ["tstyle","Kiểu đường timestamp","Dotted","s",{o:KZ_STY,on:p=>p.tsh}],
     ["tw","Độ dày timestamp",1,"i",{min:1,max:4,on:p=>p.tsh}],
     ["cut","Giờ cắt bản vẽ (cutoff)",false,"b",{g:"Toàn cục",tt:"Khi bật, pivot, midpoint, đường giá mở cửa và range level ngừng kéo dài ở giờ này. Pivot lần đầu bị phá sau giờ cắt tính là trượt trong thống kê. Không áp dụng cho D/W/M."}],
     ["cutS","Khoảng giờ cắt (HHMM-HHMM)","1800-1801","t",{on:p=>p.cut}],
     ["tz","Múi giờ","ny","s",{o:[["ny","America/New_York (tự đổi giờ mùa)"],...Array.from({length:27},(_,i)=>{const g=i-12;return["GMT"+(g<0?"":"+")+g,"GMT"+(g<0?"":"+")+g]})],tt:"GMT cố định, không điều chỉnh giờ mùa."}],
     ["lsz","Cỡ chữ nhãn","Tiny","s",{o:KZ_SZ}],
     ["tfl","Giới hạn khung giờ","1800","s",{o:[["60","M1"],["300","M5"],["900","M15"],["1800","M30"],["3600","H1"],["14400","H4"]],tt:"Không vẽ trên khung lớn hơn mức này."}],
     ["maxb","Số nến quét tối đa",20000,"i",{min:500,max:100000,tt:"Giới hạn để chart nhẹ. Hit rate và đo range chỉ tính trong phần này."}]],
  c:["#2962ff","#f23645","#089981","#ff9800","#e040fb","#9e9e9e","#2962ff","#089981","#f23645","#98a2d8","#98a2d8"],
  L:["KZ1","KZ2","KZ3","KZ4","KZ5","KZ6","Day (D)","Week (W)","Month (M)","Giá mở cửa mặc định","Timestamp mặc định"],
  lab:()=>"",f:()=>[]
};

/* ===== CRT - Candle Range Theory (HTF + PD Array): 4 model CRT, vùng CRT H/L, PD Array (OID, RB, FVG, OB, BB), nến HTF bên phải, bảng thông tin =====
   Port từ Pine Script "CRT - Candle Range Theory (HTF + PD Array)". Kiểu "of": phần tính + vẽ nằm ở js/crt.js. Màu: Bullish, Bearish, Vùng Range, RB, FVG, OB, BB. */
const CRT_TFO=[["1800","30m"],["3600","1H"],["7200","2H"],["14400","4H"],["21600","6H"],["28800","8H"],["43200","12H"],["86400","1D"],["604800","1W"]];
IND.crt={
  n:"CRT (Candle Range Theory)",t:"of",ver:1,
  d:"Candle Range Theory trên khung HTF: nến sweep (đã đóng) quét High/Low của nến Range rồi đóng cửa trở lại trong range. 4 model: 2nd Candle, 3rd Candle, Multiple Candle, Inside Bar. Vẽ vùng CRT H / mid / L kéo sang phải, PD Array trong nến sweep (OID, Rejection Block, FVG, Order Block, Breaker Block), nến HTF ở mép phải chart và bảng thông tin. Chỉ dùng nến HTF đã đóng nên không repaint. Khung HTF phải lớn hơn khung chart.",
  p:[["htf","Khung CRT (HTF)","14400","s",{g:"CRT",mn:1,o:CRT_TFO,tt:"Phải lớn hơn khung chart đang xem (ví dụ chart 15m, HTF 4H)."}],
     ["m1","Model 1: 2nd Candle CRT",true,"b"],["m2","Model 2: 3rd Candle CRT",true,"b"],["m3","Model 3: Multiple Candle CRT",true,"b"],["m4","Model 4: Inside Bar CRT",true,"b"],
     ["maxK","Số nến HTF tối đa (từ nến Range đến nến Sweep)",8,"i",{min:3,max:15}],
     ["extN","Kéo dài vùng sang phải (số nến HTF)",2,"i",{min:1,max:20}],
     ["onlyLast","Chỉ hiển thị CRT gần nhất",true,"b"],
     ["maxn","Số CRT tối đa khi hiện lịch sử",5,"i",{min:1,max:30,on:p=>!p.onlyLast}],
     ["maxScan","Số nến chart tối đa để quét PD Array",300,"i",{min:20,max:900}],
     ["alrt","Báo khi có CRT mới",true,"b",{tt:"Hiện thông báo trên thanh trạng thái và phát tiếng bíp khi nến HTF vừa đóng tạo thành CRT. Không báo khi mở chart/đổi mã/đổi HTF; chỉ báo khi xuất hiện nến HTF mới đã đóng."}],
     ["showFVG","Fair Value Gap (FVG)",true,"b",{g:"PD Array"}],["showOB","Order Block (OB)",true,"b"],["showBB","Breaker Block (BB)",true,"b"],["showRB","Rejection Block (RB)",true,"b"],
     ["showOHL","Old High/Low (OID): đỉnh/đáy bị quét",true,"b"],
     ["maxFVG","Số FVG tối đa",2,"i",{min:1,max:5,on:p=>p.showFVG}],
     ["showHTF","Hiện nến HTF bên phải",true,"b",{g:"Nến HTF bên phải"}],
     ["nHTF","Số nến HTF",5,"i",{min:1,max:6,on:p=>p.showHTF}],
     ["dock","Gắn vào mép phải chart",true,"b",{on:p=>p.showHTF,tt:"Bật: nến HTF luôn nằm sát mép phải vùng vẽ, không cần chừa khoảng trống bên phải chart. Tắt: đặt theo số nến tính từ nến cuối như bản Pine (cần kéo chart sang trái để chừa chỗ)."}],
     ["htfOff","Khoảng cách tới nến cuối (nến)",10,"i",{min:2,max:100,on:p=>p.showHTF&&!p.dock}],
     ["cW","Độ rộng thân nến",3,"i",{min:1,max:9,on:p=>p.showHTF}],
     ["cGap","Khoảng cách giữa các nến",6,"i",{min:2,max:15,on:p=>p.showHTF}],
     ["tbl","Hiện bảng thông tin",true,"b",{g:"Bảng"}],
     ["tpos","Vị trí bảng","tr","s",{o:[["tr","Trên phải"],["tl","Trên trái"],["br","Dưới phải"],["bl","Dưới trái"]],on:p=>p.tbl}]],
  c:["#089981","#f23645","#787b86","#ff9800","#2962ff","#9c27b0","#14b8a6"],
  L:["Bullish","Bearish","Vùng CRT Range","Rejection Block (RB)","FVG","Order Block (OB)","Breaker Block (BB)"],
  lab:p=>CRT_TFO.find(x=>x[0]===String(p.htf))?.[1]||"",f:()=>[]
};

/* ===== Goldbach Levels (Trifecta): PO3 dealing range với các level [03]..[97], nhiều range, fractal, mini map, PO3 tự chọn theo khung giờ =====
   Port từ Pine Script "Goldbach Trifecta Style" (MPL-2.0). Kiểu "of": phần tính + vẽ nằm ở js/goldbach.js. Màu: HL, Liquidity, GIP, Flow, Rebalance, Fractal, Level giữa. */
const GBO=["3","9","27","81","243","729","2187","6561","19683","59049","177147","531441"],GBS=GBO.map(v=>[v,v]),GBL=["Tiny","Small","Normal","Large"];
IND.gb={
  n:"Goldbach Levels (Trifecta)",t:"of",ver:1,
  d:"Chia giá thành các PO3 dealing range (3, 9, 27, 81, 243...) và vẽ các level Goldbach [03] [11] [17] [23] ... [97] của range chứa giá, kèm nhiều range chồng lên trên và dưới. Nhóm màu: Liquidity (03, 11, 89, 97), GIP (17, 83), Flow (23-35, 65-77), Rebalance (41-59). Có Fractal Fib (range con = PO3/3), Mini Map, vùng tô OB/LV/EQ, và PO3 tự chọn theo khung giờ đang xem.",
  p:[["po3","PO3","81","s",{g:"PO3 Dealing Range",mn:1,o:GBS,on:p=>!p.aut,tt:"Độ rộng range tính theo đơn vị giá sau khi nhân Decimate. Vàng/chỉ số thường dùng 81 đến 729 (Decimate 1); Forex dùng Decimate 10000."}],
     ["dec","Decimate (0 = tự động)",0,"n",{min:0,step:1,tt:"Giá được nhân với số này trước khi áp lưới PO3. 0 = tự đoán: Forex 10000, cặp JPY 100, còn lại 1."}],
     ["nr","Số range mở rộng",2,"i",{mn:1,min:0,max:5,tt:"Số range vẽ thêm phía trên và phía dưới range chính."}],
     ["upd","Cập nhật mỗi tick",false,"b",{tt:"Bật: range căn lại theo từng tick. Tắt: chỉ căn lại khi nến đóng (dùng giá đóng cửa của nến trước)."}],
     ["ffib","Fractal Fib",false,"b",{g:"Fractals",tt:"Vẽ range con (PO3 / 3) chứa giá, có đủ level riêng."}],
     ["hmain","Ẩn level chính",false,"b",{tt:"Ẩn các level [03]..[97] của range, chỉ giữ High/Low của range."}],
     ["mids","Level giữa",false,"b",{tt:"Thêm đường chấm ở giữa mỗi cặp level kề nhau."}],
     ["mm","Bật Mini Map",false,"b",{g:"Mini Map",tt:"Cột range thu nhỏ đặt bên phải nến cuối, thấy cả các range lân cận."}],
     ["mms","Tự cuộn theo nến cuối",true,"b",{on:p=>p.mm,tt:"Bật: mini map đi theo nến cuối. Tắt: ghim ở mép trái vùng đang xem."}],
     ["mmx","Vị trí X (số nến)",20,"i",{min:0,max:200,on:p=>p.mm}],
     ["mmb","Độ rộng (số nến)",40,"i",{min:5,max:200,on:p=>p.mm}],
     ["aut","Tự chọn PO3 theo khung giờ",false,"b",{g:"PO3 tự động",mn:1,tt:"Chọn PO3 theo khung giờ của chart bằng bảng bên dưới."}],
     ["aY","Năm","6561","s",{o:GBS,on:p=>p.aut}],["aQ","Quý","6561","s",{o:GBS,on:p=>p.aut}],["aMo","Tháng","6561","s",{o:GBS,on:p=>p.aut}],
     ["aW","Tuần","2187","s",{o:GBS,on:p=>p.aut}],["aD","Ngày","729","s",{o:GBS,on:p=>p.aut}],["a4","H4","729","s",{o:GBS,on:p=>p.aut}],
     ["a1h","H1","243","s",{o:GBS,on:p=>p.aut}],["a15","M15 / M30","81","s",{o:GBS,on:p=>p.aut}],["a3","M3 / M5 / M9","27","s",{o:GBS,on:p=>p.aut}],["a1","M1","27","s",{o:GBS,on:p=>p.aut}],
     ["shift","Dịch range",0,"n",{g:"Cơ bản",step:0.1,tt:"Dịch lưới PO3 theo tỉ lệ của một range (0.5 = nửa range)."}],
     ["uh","Dùng giá lịch sử",false,"b",{tt:"Dựng range quanh giá bên dưới thay vì giá hiện tại."}],
     ["hp","Giá lịch sử",0,"n",{min:0,on:p=>p.uh}],
     ["lbl","Hiện nhãn",true,"b",{g:"Kiểu dáng"}],
     ["eq","Hiện EQ [50]",true,"b"],
     ["ext","Kéo đường sang phải",false,"b",{tt:"Tắt: đường dừng ở nến cuối, nhãn ngay sau đó. Bật: đường chạy hết chart, nhãn sát trục giá."}],
     ["lo","Khoảng cách nhãn (nến)",1,"i",{min:0,max:50,on:p=>!p.ext}],
     ["lsz","Cỡ chữ nhãn","Small","s",{o:GBL,on:p=>p.lbl}],
     ["lw","Độ dày level",1,"i",{min:1,max:4}],
     ["hw","Độ dày High/Low",2,"i",{min:1,max:5}],
     ["sg","Kiểu đường GIP [17/83]","Dotted","s",{o:KZ_STY}],
     ["sl","Kiểu đường LV [23/77]","Dotted","s",{o:KZ_STY}],
     ["se","Kiểu đường EQ [50]","Dotted","s",{o:KZ_STY,on:p=>p.eq}],
     ["fob","Tô vùng OB [03-11 / 89-97]",true,"b"],
     ["flv","Tô vùng LV/BR [23-35 / 65-77]",false,"b"],
     ["feq","Tô vùng EQ [41-59]",false,"b"],
     ["zop","Độ mờ vùng tô",0.1,"n",{min:0.02,max:0.6,step:0.02,on:p=>p.fob||p.flv||p.feq}],
     ["info","Hiện bảng thông tin",true,"b"]],
  c:["#98a2d8","#26c882","#ffb02e","#35b6ff","#ff5c8a","#b388ff","#98a2d8"],
  L:["Range High/Low","Liquidity [03,11,89,97]","GIP [17,83]","Flow [23-35,65-77]","Rebalance [41-59]","Fractal","Level giữa"],
  lab:p=>"PO3 "+(p.aut?"auto":p.po3),f:()=>[]
};

/* ===== Quarterly Theory [QT]: chu kỳ A-M-D-X của Năm, Tháng, Tuần, Ngày, 90 phút, 22.5 phút, vẽ thành thanh các làn thẳng hàng với trục thời gian =====
   Port từ Pine Script "Quarterly Theory [QT]" (MPL-2.0). Kiểu "of": phần tính + vẽ nằm ở js/qt.js. Mọi mốc theo giờ New York. */
IND.qt={
  n:"Quarterly Theory [QT]",t:"of",ver:1,
  d:"Mỗi chu kỳ chia 4 phần: A (Accumulation), M (Manipulation), D (Distribution), X (Reversal / Continuation). Gồm chu kỳ Năm (quý), Tháng (4 tuần theo thứ Hai), Tuần (Thứ 2 đến Thứ 5), Ngày (4 khối 6 giờ từ 18:00 New York), 90 phút và 22.5 phút. Kiểu mặc định là Box trên chart: mỗi phiên 6 giờ (Asia, London, NY AM, NY PM) vẽ khung nét đứt theo High/Low, chia 4 ô 90 phút A-M-D-X tô theo High/Low từng ô, kèm đường giá mở cửa AO/LO/NYO/PMO và True Day Open. Có thể đổi sang kiểu thanh làn cũ: các làn nằm thành một thanh trên chart, thẳng hàng với nến, ô hiện tại có viền nổi.",
  p:[["style","Kiểu hiển thị","box","s",{g:"Hiển thị",mn:1,o:[["box","Box trên chart (kiểu phiên)"],["lane","Thanh làn (kiểu cũ)"]],tt:"Box: mỗi phiên 6 giờ vẽ thành khung nét đứt theo High/Low, chia 4 ô 90 phút A-M-D-X, kèm đường giá mở cửa AO/LO/NYO/PMO và TDO. Thanh làn: kiểu cũ, các chu kỳ nằm thành thanh dưới/trên chart."}],
     ["bdays","Số ngày giao dịch hiển thị",3,"i",{min:1,max:30,on:p=>p.style!=="lane",tt:"Ngày giao dịch bắt đầu 18:00 New York. Càng nhiều ngày càng nhiều box."}],
     ["bsess","Khung phiên nét đứt (Asia / London / NY AM / NY PM)",true,"b",{on:p=>p.style!=="lane"}],
     ["bq","Chia 4 ô 90 phút A-M-D-X (theo High/Low từng ô)",true,"b",{on:p=>p.style!=="lane"}],
     ["bol","Đường giá mở cửa phiên (AO / LO / NYO / PMO)",true,"b",{on:p=>p.style!=="lane"}],
     ["bnm","Hiện tên + giá trên đường",true,"b",{on:p=>p.style!=="lane"}],
     ["tdo","True Day Open (TDO)","mid","s",{on:p=>p.style!=="lane",o:[["mid","Bật · mở cửa 00:00 New York"],["open","Bật · mở cửa 18:00 (đầu ngày giao dịch)"],["off","Tắt"]]}],
     ["bop","Độ mờ ô 90 phút",0.18,"n",{min:0.05,max:0.6,step:0.01,on:p=>p.style!=="lane"}],
     ["lbl","Hiện chữ A / M / D / X",true,"b"],
     ["pos","Vị trí thanh","bot","s",{g:"Thanh làn",mn:1,on:p=>p.style==="lane",o:[["bot","Dưới chart"],["top","Trên chart"]]}],
     ["hist","Hiện chu kỳ lịch sử",true,"b",{mn:1,on:p=>p.style==="lane",tt:"Tắt: chỉ giữ chu kỳ hiện tại (và tháng trước để luôn thấy ô đang chạy của chu kỳ Tháng)."}],
     ["size","Cỡ thanh (×)",1,"n",{min:0.5,max:3,step:0.1,on:p=>p.style==="lane"}],
     ["full","Tên đầy đủ khi ô đủ rộng",true,"b",{on:p=>p.style==="lane"&&p.lbl}],
     ["brd","Viền ô",true,"b",{on:p=>p.style==="lane"}],
     ["bg","Nền thanh",true,"b",{on:p=>p.style==="lane"}],
     ["leg","Hiện chú giải",true,"b",{on:p=>p.style==="lane"}],
     ["now","Viền ô hiện tại",true,"b",{on:p=>p.style==="lane"}],
     ["op","Độ mờ ô",0.45,"n",{min:0.1,max:1,step:0.05,on:p=>p.style==="lane"}],
     ["cy","Chu kỳ Năm",true,"b",{g:"Chu kỳ (thanh làn)",on:p=>p.style==="lane"}],["cmo","Chu kỳ Tháng",true,"b",{on:p=>p.style==="lane"}],["cw","Chu kỳ Tuần",true,"b",{on:p=>p.style==="lane"}],["cd","Chu kỳ Ngày",true,"b",{on:p=>p.style==="lane"}],
     ["c90","Chu kỳ 90 phút",true,"b",{on:p=>p.style==="lane"}],["cmc","Chu kỳ 22.5 phút",false,"b",{on:p=>p.style==="lane"}]],
  c:["#98a2d8","#ff5c8a","#26c882","#35b6ff"],
  L:["A (Accumulation)","M (Manipulation)","D (Distribution)","X (Reversal/Cont)"],
  lab:()=>"",f:()=>[]
};

/* ===== ICT 2022 Mentorship — Full Toolkit =====
   Bao phủ 33 chương bằng các lớp tự động (OHLC + thời gian), mô hình tham khảo và phần nhập tay.
   Mô tả và giới hạn nằm trong README.md, mục ICT 2022. Kiểu "of" vẽ trong js/ict-2022.js. */
IND.ict22={
  n:"ICT 2022 · Full Toolkit",t:"of",ver:3,
  d:"Bộ công cụ ICT 2022 đa lớp theo 33 chương PDF: cấu trúc ST/IT/LT, HH/HL/LH/LL, BOS/MSS; thanh khoản/sweep; PD Arrays và block; dealing range, Premium/Discount, OTE; Sessions/Killzones New York; PO3/AMD, Judas, Three Drives, Silver Bullet; NWOG/NDOG, CBDR, ADR, IPDA, Quarterly Shift; HTF→LTF Entry Drill; dashboard Daily Bias/DOL; và Trade Plan SL/TP/RR/BE nhập tay. Mô hình chỉ là suy luận OHLC/time; SMT và tin cần nguồn ngoài.",
  p:[
    ["visualMode","Chế độ hiển thị","clean","s",{g:"Hiển thị nhanh",o:[["clean","Gọn · khuyên dùng"],["full","Đầy đủ · chuyên sâu"]],tt:"Gọn: chỉ vẽ các mức và vùng quan trọng gần giá. Đầy đủ: bật tất cả lớp phân tích đã chọn."}],
    ["closedOnly","Chỉ dùng nến đã đóng (chống repaint)",true,"b",{g:"Dữ liệu & chất lượng tín hiệu",tt:"Bật: bỏ nến cuối đang chạy khi tính pivot, BOS/MSS, FVG, sweep và các mô hình. Mức giá phiên vẫn dựa trên nến M1 đã đóng. Tắt: có thể thay đổi theo tick."}],
    ["maxBars","Số nến chart quét tối đa",6000,"i",{min:500,max:30000}],
    ["maxM1","Số nến M1 tối đa cho Session / HTF",140000,"i",{min:1000,max:250000}],
    ["atrLen","ATR lookback",14,"i",{min:2,max:100}],
    ["pivotL","Pivot trái (nến)",2,"i",{min:1,max:10}],
    ["pivotR","Pivot phải xác nhận (nến)",2,"i",{min:1,max:10,tt:"Pivot chỉ được công nhận sau khi có đủ nến bên phải, không đánh dấu sớm."}],
    ["eqTol","Dung sai Equal High/Low (× ATR)",0.08,"n",{min:0.01,max:0.5,step:0.01}],
    ["fvgStrict","Lọc FVG tối thiểu theo ATR",true,"b"],
    ["fvgATR","FVG tối thiểu (× ATR)",0.08,"n",{min:0,max:1,step:0.01,on:p=>p.fvgStrict}],
    ["lvATR","Liquidity Void khi FVG ≥ ATR ×",1.25,"n",{min:0.5,max:5,step:0.05}],
    ["obWick","OB dùng toàn bộ râu nến",true,"b",{tt:"Bật: lấy High–Low của nến đối ứng. Tắt: lấy thân nến Open–Close."}],
    ["rbWick","Râu RB tối thiểu so với thân",1.4,"n",{min:0.5,max:5,step:0.1}],
    ["maxZones","Số vùng PD Array hiển thị",8,"i",{min:3,max:100}],
    ["extend","Kéo vùng về bên phải (số nến)",25,"i",{min:1,max:300}],
    ["showFilled","Giữ vùng đã fill / mitigate",false,"b"],
    ["structure","BOS / MSS (xác nhận bằng Close)",true,"b",{g:"Cấu trúc thị trường & thanh khoản"}],
    ["pivots","STH/STL · ITH/ITL · HH/HL/LH/LL",false,"b"],
    ["eq","Equal High / Equal Low (EQH/EQL)",true,"b"],
    ["sweeps","BSL/SSL sweep · Stop hunt / Turtle Soup",true,"b"],
    ["prevLevels","PDH/PDL · HOD/LOD · HOW/LOW · 3 ngày · PWH/PWL · PMH/PML · PQH/PQL",true,"b"],
    ["opens","D/W/M/Q Open · 00:00 / 02:00 / 05:00 / 07:00 / 07:20 / 08:30 / 09:30 NY",false,"b"],
    ["dailySwings","Daily Swing High/Low (mô hình 3 nến)",false,"b"],
    ["range","Dealing Range · Equilibrium 50% · Premium/Discount",true,"b",{g:"PD Arrays & Fibonacci"}],
    ["ote","OTE 62% / 70.5% / 79%",true,"b"],
    ["fvg","FVG · CE 50% · Liquidity Void",true,"b"],
    ["ifvg","Inversion FVG (IFVG)",false,"b"],
    ["bpr","Balanced Price Range (BPR)",false,"b"],
    ["blocks","Order Block (OB) · Breaker Block (BB)",true,"b"],
    ["rb","Rejection Block (RB)",false,"b"],
    ["mb","Mitigation Block (MB — heuristic)",false,"b"],
    ["vi","Volume Imbalance (VI — OHLC proxy)",false,"b"],
    ["sessions","Killzones / Sessions (NY time, DST tự động)",false,"b",{g:"Time & Day Models"}],
    ["models","PO3/AMD · Judas Swing · Three Drives · Silver Bullet",false,"b"],
    ["entryDrill","LTF Entry Drill: 5 → 4 → 3 → 2 → 1 phút (displacement + FVG)",false,"b"],
    ["adr","ADR 5D/20D/50D · 50% ADR5 projection",true,"b"],
    ["cbdr","CBDR 14:00–20:00 NY · Range projections ±1–4",false,"b"],
    ["gaps","New Day / New Week Opening Gap (NDOG/NWOG)",false,"b"],
    ["ipda","IPDA 20 / 40 / 60 Trading-Day Range",false,"b"],
    ["quarter","Quarterly Open / Quarterly Shift context",false,"b"],
    ["newsOn","Hiện mốc tin tức nhập thủ công",false,"b",{g:"News / Dashboard"}],
    ["planOn","Bật Trade Plan (Entry / SL / TP / RR / BE)",false,"b",{g:"Trade Plan · nội dung thuật ngữ & quản trị giao dịch"}],
    ["planDir","Hướng kế hoạch","long","s",{o:[["long","BUY / Long"],["short","SELL / Short"]],on:p=>p.planOn}],
    ["planEntry","Giá Entry",0,"n",{min:0,step:0.01,on:p=>p.planOn}],
    ["planStop","Giá Stop Loss (SL)",0,"n",{min:0,step:0.01,on:p=>p.planOn}],
    ["planTarget","Giá Take Profit (TP)",0,"n",{min:0,step:0.01,on:p=>p.planOn}],
    ["beAtR","Mốc tham chiếu Break-even (R)",1,"n",{min:0,max:5,step:0.25,on:p=>p.planOn,tt:"Ví dụ 1R: khi giá đi được một lần khoảng rủi ro, đây là mốc tham chiếu để cân nhắc dời SL về Entry. Indicator không tự sửa lệnh."}],
    ["newsText","Lịch tin (giờ New York, mỗi dòng 1 mục)","# YYYY-MM-DD HH:MM, Tên sự kiện\n# 2026-11-10 08:30, CPI\n# 2026-11-13 08:30, PPI","ta",{rows:4,on:p=>p.newsOn,tt:"Không có API lịch kinh tế trong project. Nhập giờ New York: YYYY-MM-DD HH:MM, label. Mốc chỉ được vẽ đúng theo chuỗi bạn nhập; không tự tải hoặc dự đoán tin."}],
    ["dashboard","Dashboard ICT gọn",true,"b"],
    ["dashPos","Vị trí Dashboard","tr","s",{on:p=>p.dashboard,o:[["tr","Trên phải"],["tl","Trên trái"],["br","Dưới phải"],["bl","Dưới trái"]]}]
  ],
  c:["#20c997","#ff5c7a","#f6c453","#39a7ff","#a78bfa","#22b8cf","#fb923c","#f472b6"],
  L:["Bullish","Bearish","Liquidity","FVG","Order Block","Session","Breaker","Rejection"],
  lab:()=>"33 chương · ICT 2022",
  f:()=>[]
};

/* ===== Cross-Asset ETF Options Liquidity Map =====
   Projects QQQ -> NAS100 and GLD -> XAUUSD option-derived levels onto the active cTrader chart.
   Rendering/data lifecycle lives in cross-asset-map.js; this definition makes it a normal,
   persistent indicator with an eye toggle and the standard settings dialog.
*/
IND.xmap={
  n:"ETF Options Liquidity Map",t:"of",ver:1,
  d:"Chiếu heatmap OI/GEX, volume bubbles, Call/Put OI Walls (OI-only), CW/PW (Net GEX walls), Gamma Flip / Zero Gamma (BSM repricing), Max Pain, GEX Ratio và GEX 1–10 từ QQQ → NAS100 hoặc GLD → XAUUSD. Call/Put OI Walls được tính độc lập theo OI lớn nhất từng phía. CW là strike có Net GEX dương lớn nhất; PW là strike có Net GEX âm lớn nhất theo trị tuyệt đối. GEX 1–10 loại riêng CW/PW, không loại OI Walls. Từng level được quy đổi và lưu riêng; giá ETF/CFD chạy không làm level dịch chuyển. Chỉ khi giá trị level nguồn thay đổi, riêng level đó mới tự động được quy đổi lại theo tỷ lệ spot tại thời điểm phát hiện thay đổi. GEX walls, GEX ladder và GEX Ratio chỉ hiển thị khi toàn expiry có đủ OI, multiplier, gamma và spot; Gamma Flip / Zero Gamma cần thêm IV và DTE hợp lệ, được tính bằng Black–Scholes repricing với IV/DTE cố định, r=q=0 và tìm Net GEX zero-cross. GEX Ratio = tổng Call GEX / |tổng Put GEX|; >1 là Call Gamma trội (thiên hướng ổn định/biên độ hẹp), <1 là Put Gamma trội (rủi ro biến động/trượt giá cao). Đây là heuristic theo quy ước Call+/Put−, không xác nhận dealer positioning.",
  p:[
    ["source","Nguồn ETF","qqq","s",{g:"Nguồn dữ liệu",o:[["qqq","QQQ → NAS100"],["gld","GLD → XAUUSD"]]}],
    ["metric","Heatmap theo","gex","s",{g:"Heatmap",o:[["gex","Net GEX"],["oi","Open Interest"],["vol","Volume"]]}],
    ["heat","Hiện heatmap",true,"b"],
    ["opacity","Độ mờ heatmap",0.48,"n",{min:0.1,max:0.9,step:0.05}],
    ["bubbles","Hiện volume bubbles",true,"b",{g:"Volume bubbles"}],
    ["bubbleCount","Số bubble tối đa",36,"i",{min:5,max:100,step:1}],
    ["walls","Call / Put OI Walls (OI-only)",true,"b",{g:"Key levels"}],
    ["gexWalls","CW / PW · Net GEX Walls",true,"b"],
    ["gammaFlip","Gamma Flip / Zero Gamma (BSM repricing)",true,"b"],
    ["maxPain","Max Pain",true,"b"],
    ["gexCount","Số level GEX 1–10 (0 = tắt)",10,"i",{min:0,max:10,step:1}],
    ["showSourceTag","Nhãn nguồn dữ liệu trên chart",true,"b"]
  ],
  c:["#35b6ff","#ec557c","#35e59a","#ff536b","#ff5c8a","#35d6b0","#ffc857","#b68cff","#43c7e8","#a7d96b","#65d6e8","#e8bd73"],
  L:["Heatmap dương / OI","Heatmap âm","Call bubble","Put bubble","Call OI Wall","Put OI Wall","Gamma Flip / Zero Gamma · BSM","Max Pain","GEX 1–10","CW · Max +Net GEX","PW · Max |−Net GEX|"],
  lab:p=>`${p.source==='gld'?'GLD → XAUUSD':'QQQ → NAS100'} · ${String(p.metric||'gex').toUpperCase()} · GEX ${p.gexCount??10}/10`,
  f:()=>[]
};
