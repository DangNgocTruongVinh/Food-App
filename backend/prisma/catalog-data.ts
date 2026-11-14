import type { StorageLocation } from "@prisma/client";

/**
 * Dữ liệu BAN ĐẦU của các danh mục nghiệp vụ (seed). Code chạy thật KHÔNG đọc file này: dữ liệu nằm trong các bảng
 * AllergenGroup/Alias/Term/Exclusion, FoodCategory/Term/ShelfLifeRule, ReceiptAbbreviation, ReceiptSkipKeyword và được đọc qua
 * services/catalog/catalog.service.ts. File này chỉ dùng để: (1) tạo dữ liệu khi bảng còn trống (seed, lần đầu khởi động sau
 * migration), (2) nạp cùng dữ liệu cho test và script đánh giá mô phỏng (chạy trong bộ nhớ, không có DB).
 * Nội dung chuyển nguyên văn từ code trước đây (allergy-groups.ts, food-category.ts, pantry-purchase.ts, receipt-aliases.ts,
 * receipt-parser.ts) để kết quả lọc, nhóm thực phẩm, hạn ước tính và đọc hóa đơn giống hệt trước.
 */

// ---------- Dị ứng ----------
/** Định dạng gọn để viết tay; seed đổi sang các bảng (covers → parentId của nhóm con, mayContain → level MAY_CONTAIN). */
export type AllergenGroupSeed = {
  id: string;
  label: string;
  aliases: string[];
  terms: string[];
  mayContain?: string[];
  excludes?: string[];
  covers?: string[];
};

const PLANT_MILKS = ["sữa đậu nành", "sữa hạnh nhân", "sữa óc chó", "sữa hạt", "sữa dừa", "sữa yến mạch", "sữa gạo", "sữa bắp"];

export const ALLERGEN_GROUP_SEED: AllergenGroupSeed[] = [
  {
    id: "EGG", label: "Trứng",
    aliases: ["trứng", "trứng gà", "trứng vịt", "trứng cút", "trứng gà ta", "lòng đỏ", "lòng trắng", "egg", "eggs"],
    terms: ["trứng", "lòng đỏ", "lòng trắng", "mayonnaise", "sốt mayonnaise", "sốt mayo", "mayo", "sốt trứng"],
  },
  {
    id: "MILK", label: "Sữa",
    aliases: ["sữa", "sữa bò", "sản phẩm từ sữa", "lactose", "đạm sữa", "milk", "dairy"],
    terms: [
      "sữa", "sữa tươi", "sữa chua", "sữa đặc", "sữa bột", "phô mai", "pho mát", "bơ", "bơ lạt", "bơ nhạt", "bơ động vật", "kem", "kem tươi",
      "kem sữa", "váng sữa", "whey", "cheese", "butter",
    ],
    // "Bơ" một mình là bơ sữa; "quả bơ"/"trái bơ"/"sinh tố bơ" là trái cây, "bơ đậu phộng" thuộc Đậu phộng.
    excludes: [...PLANT_MILKS, "sữa chua đậu nành", "quả bơ", "trái bơ", "sinh tố bơ", "bơ đậu phộng", "bơ thực vật", "kem dừa"],
  },
  {
    id: "SEAFOOD", label: "Hải sản",
    aliases: ["hải sản", "thủy sản", "đồ biển", "seafood"], terms: [], covers: ["FISH", "CRUSTACEAN", "MOLLUSC"],
  },
  {
    id: "FISH", label: "Cá",
    aliases: ["cá", "fish", "cá biển", "cá sông"],
    terms: [
      "cá", "cá hồi", "cá lóc", "cá basa", "cá thu", "cá ngừ", "cá rô", "cá diêu hồng", "cá cơm", "nước mắm", "mắm", "mắm nêm", "dầu cá",
      "mắm cá", "mắm cá linh", "mắm thái",
    ],
  },
  {
    id: "CRUSTACEAN", label: "Giáp xác",
    aliases: ["giáp xác", "tôm cua", "shrimp", "crab", "shellfish"],
    terms: ["tôm", "tôm sú", "tôm thẻ", "tôm khô", "tép", "cua", "ghẹ", "mắm tôm", "ruốc", "mắm ruốc", "tôm hùm", "gạch cua", "bánh phồng tôm"],
  },
  {
    id: "MOLLUSC", label: "Nhuyễn thể",
    aliases: ["nhuyễn thể", "thân mềm", "squid", "clam", "oyster"],
    terms: ["mực", "bạch tuộc", "nghêu", "ngao", "sò", "hến", "ốc", "hàu", "sò điệp", "vẹm", "dầu hào", "sốt dầu hào"],
  },
  {
    id: "PEANUT", label: "Đậu phộng",
    aliases: ["đậu phộng", "lạc", "peanut", "peanuts"],
    terms: ["đậu phộng", "lạc", "lạc rang", "bơ đậu phộng", "dầu đậu phộng", "dầu lạc", "sốt đậu phộng", "muối đậu phộng"],
    mayContain: ["sa tế", "tương đậu phộng", "nước chấm gỏi cuốn"],
  },
  {
    id: "TREE_NUT", label: "Hạt cây",
    aliases: ["hạt cây", "các loại hạt", "hạt", "tree nut", "tree nuts", "nuts"],
    terms: ["óc chó", "hạnh nhân", "hạt điều", "hạt dẻ", "hạt phỉ", "hồ đào", "mắc ca", "macca", "hạt thông", "hạt dẻ cười", "sữa hạnh nhân", "sữa óc chó"],
  },
  {
    id: "GLUTEN", label: "Gluten",
    aliases: ["gluten", "lúa mì", "bột mì", "wheat"],
    terms: [
      "bột mì", "bánh mì", "mì", "mì ý", "mì trứng", "mì gói", "bột chiên giòn", "bột chiên xù", "lúa mì", "lúa mạch", "pasta",
      "nước tương", "xì dầu", "vỏ bánh bao", "bánh bao", "mì căn", "seitan",
    ],
    // Tùy nhãn hàng: tương đen (hoisin), tương ớt Hàn Quốc (gochujang), dầu hào thường có bột mì; yến mạch, bún tàu dễ lẫn lúa mì.
    mayContain: ["tương đen", "tương ớt hàn quốc", "gochujang", "dầu hào", "sốt dầu hào", "miso", "yến mạch", "bún tàu", "bột năng trộn"],
    // "Mì" là lúa mì, trừ mì chính (bột ngọt) và mì Quảng (bột gạo).
    excludes: ["mì chính", "mì quảng"],
  },
  {
    id: "SOY", label: "Đậu nành",
    aliases: ["đậu nành", "đỗ tương", "đậu tương", "soy", "soya"],
    terms: [
      "đậu nành", "đỗ tương", "đậu tương", "sữa đậu nành", "đậu hũ", "đậu phụ", "tàu hũ", "tào phớ", "tàu hũ ky", "váng đậu", "nước tương",
      "xì dầu", "tương đen", "tương bần", "tương hột", "tương ớt hàn quốc", "gochujang", "miso", "chao", "tempeh", "edamame",
    ],
    mayContain: ["dầu hào", "sốt dầu hào", "hạt nêm chay"],
  },
  {
    id: "SESAME", label: "Mè",
    aliases: ["mè", "vừng", "sesame"],
    terms: ["mè", "vừng", "mè rang", "dầu mè", "dầu vừng", "muối mè", "tahini", "sốt mè"],
    mayContain: ["tương đen", "sốt mè rang"],
  },
];

/**
 * Nguyên liệu chế biến / gia vị / thành phần ẩn (cột AllergenTerm.processed). DỊ ỨNG tính cả những thứ này (an toàn trước); MÓN
 * KHÔNG THÍCH (khẩu vị) thì không: không thích "cá" vẫn ăn được món có nước mắm.
 */
export const PROCESSED_TERM_SEED = new Set([
  "nước mắm", "mắm", "mắm nêm", "dầu cá", "mắm cá", "mắm cá linh", "mắm thái", "mắm tôm", "ruốc", "mắm ruốc", "bánh phồng tôm", "gạch cua",
  "dầu hào", "sốt dầu hào", "mayonnaise", "sốt mayonnaise", "sốt mayo", "mayo", "sốt trứng", "whey", "nước tương", "xì dầu", "tương đen",
  "tương bần", "tương hột", "tương ớt hàn quốc", "gochujang", "miso", "chao", "bột chiên giòn", "bột chiên xù", "vỏ bánh bao",
  "dầu đậu phộng", "dầu lạc", "sốt đậu phộng", "muối đậu phộng", "bơ đậu phộng", "dầu mè", "dầu vừng", "muối mè", "tahini", "sốt mè",
  "sữa hạnh nhân", "sữa óc chó", "sữa đậu nành",
]);

// ---------- Nhóm thực phẩm (Kho, đi chợ) ----------
export type FoodCategorySeed = {
  name: string;
  defaultStorage: StorageLocation;
  /** null = không đặt hạn. Nhóm có loại con (Đậu & hạt, Ngũ cốc): hạn mặc định là loại "không chắc" (hạn ngắn, an toàn hơn). */
  defaultShelfLifeDays: number | null;
  isFallback?: boolean;
};
export const FOOD_CATEGORY_SEED: FoodCategorySeed[] = [
  { name: "Rau củ", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: 5 },
  { name: "Thịt & cá", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: 2 },
  { name: "Trứng & sữa", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: 7 },
  { name: "Đậu & hạt", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: 3 }, // đậu hũ, đậu tươi; hạt khô xem quy tắc hạn
  { name: "Ngũ cốc", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: 2 }, // đồ tươi (bún, bánh phở…); đồ khô xem quy tắc hạn
  { name: "Trái cây", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: 5 },
  { name: "Gia vị", defaultStorage: "DRY_STORAGE", defaultShelfLifeDays: 180 },
  { name: "Khác", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: null, isFallback: true },
];

/**
 * Từ đầu tên → nhóm, theo thứ tự ưu tiên (priority = vị trí trong mảng): khớp đầu tiên thắng, ngoại lệ trước ("đậu bắp",
 * "đậu hà lan" là rau; "cà" khác "cá"). Không khớp → nhóm isFallback ("Khác").
 */
export const FOOD_CATEGORY_TERM_SEED: Array<[string, string[]]> = [
  ["Rau củ", ["đậu bắp", "đậu hà lan", "đậu que", "bắp ngọt", "đu đủ xanh", "ớt chuông"]],
  ["Gia vị", ["muối", "đường", "tiêu", "nước mắm", "nước tương", "tương", "giấm", "dầu", "mật ong", "quế", "hoa hồi", "lá oregano", "mè", "hạt nêm", "bột ngọt", "ô liu"]],
  ["Thịt & cá", ["thịt", "sườn", "xương", "đùi gà", "ức gà", "cánh gà", "gà", "bò", "heo", "cá", "tôm", "mực", "cua", "nghêu"]],
  ["Trứng & sữa", ["trứng", "sữa", "phô mai", "bơ lạt"]],
  ["Đậu & hạt", ["đậu", "hạt", "lạc"]],
  ["Ngũ cốc", ["gạo", "nếp", "bún", "bánh", "mì", "miến", "yến mạch", "bột"]],
  ["Trái cây", ["chuối", "chanh", "thơm", "dứa", "quả", "táo", "cam", "xoài", "nước dừa", "nước cốt dừa", "dừa", "me"]],
  ["Rau củ", ["rau", "cải", "cà", "bí", "hành", "tỏi", "gừng", "sả", "ớt", "nấm", "giá", "xà lách", "dưa", "khoai", "bông cải", "hẹ", "ngò", "bạc hà", "lá", "su", "măng", "đu đủ"]],
];

export type ShelfLifeRuleSeed = {
  category: string;
  patterns: string[];
  matchMode: "PREFIX" | "PREFIX_WORD" | "CONTAINS_WORD";
  shelfLifeDays: number | null;
  storage: StorageLocation;
};
/** Hạn riêng cho loại con, xét theo thứ tự trong mảng (priority); không khớp thì theo hạn mặc định của nhóm. */
export const SHELF_LIFE_RULE_SEED: ShelfLifeRuleSeed[] = [
  // Hạt khô (đậu phộng, mè, đậu xanh/đen/đỏ/nành khô…) để lâu ở nơi khô ráo.
  { category: "Đậu & hạt", patterns: ["đậu phộng", "đậu xanh", "đậu đen", "đậu đỏ", "đậu nành", "đậu trắng", "đậu gà", "đậu lăng", "lạc", "hạt", "mè", "vừng"], matchMode: "PREFIX", shelfLifeDays: 90, storage: "DRY_STORAGE" },
  // Ngũ cốc khô (gạo, nếp, mì/bún/phở khô, mì gói, miến, nui, yến mạch, bột, bánh tráng); tên có chữ "khô" luôn là đồ khô.
  { category: "Ngũ cốc", patterns: ["gạo", "nếp", "yến mạch", "bột", "miến", "nui", "mì ý", "mì gói", "mì tôm", "bánh tráng", "ngũ cốc"], matchMode: "PREFIX", shelfLifeDays: 180, storage: "DRY_STORAGE" },
  { category: "Ngũ cốc", patterns: ["khô"], matchMode: "CONTAINS_WORD", shelfLifeDays: 180, storage: "DRY_STORAGE" },
  // Bánh mì để ngăn mát nhanh khô cứng nên để nơi khô ráo (vẫn hạn 2 ngày).
  { category: "Ngũ cốc", patterns: ["bánh mì"], matchMode: "PREFIX_WORD", shelfLifeDays: 2, storage: "DRY_STORAGE" },
];

// ---------- Hóa đơn ----------
/** Tên thường gặp trên hóa đơn siêu thị (đã bỏ dấu, chữ thường) → tên thực phẩm có dấu (khớp tiền tố nguyên từ). */
export const RECEIPT_ABBREVIATION_SEED: Array<[string, string]> = [
  ["thit lon", "Thịt heo"], ["thit heo", "Thịt heo"], ["thit heo xay", "Thịt heo xay"], ["thit xay", "Thịt heo xay"],
  ["ba roi", "Thịt ba chỉ"], ["ba chi", "Thịt ba chỉ"], ["thit ba roi", "Thịt ba chỉ"], ["suon non", "Sườn non"],
  ["thit bo", "Thịt bò"], ["bo xay", "Thịt bò xay"], ["uc ga", "Ức gà"], ["dui ga", "Đùi gà"], ["canh ga", "Cánh gà"],
  ["ga ta", "Gà ta"], ["ca hoi", "Cá hồi"], ["ca basa", "Cá basa"], ["ca thu", "Cá thu"], ["tom su", "Tôm sú"],
  ["tom the", "Tôm thẻ"], ["muc ong", "Mực ống"],
  ["trung ga", "Trứng gà"], ["trung vit", "Trứng vịt"], ["trung cut", "Trứng cút"],
  ["sua tuoi", "Sữa tươi"], ["sua chua", "Sữa chua"], ["sua dac", "Sữa đặc"], ["sua dau nanh", "Sữa đậu nành"],
  ["dau hu", "Đậu hũ"], ["dau phu", "Đậu hũ"], ["tau hu", "Đậu hũ"],
  ["nam huong", "Nấm hương"], ["nam rom", "Nấm rơm"], ["gia do", "Giá đỗ"],
  ["chuoi", "Chuối"], ["tao", "Táo"], ["cam", "Cam"], ["xoai", "Xoài"], ["dua hau", "Dưa hấu"],
  ["nuoc mam", "Nước mắm"], ["nuoc tuong", "Nước tương"], ["xi dau", "Nước tương"], ["dau an", "Dầu ăn"],
  ["muoi", "Muối"], ["duong", "Đường"], ["hat nem", "Hạt nêm"], ["bot ngot", "Bột ngọt"], ["mi chinh", "Bột ngọt"],
];

export type SkipKeywordSeed = {
  reason: string;
  WORD?: string[];
  PREFIX?: string[];
  LINE?: string[];
  LINE_SUFFIX?: string[];
};
/**
 * Dòng không phải hàng (so trên chữ đã bỏ dấu, bỏ số). Thứ tự lý do quan trọng: thuế, giảm giá trước tổng tiền ("Tổng giảm giá"
 * là giảm giá). Tránh từ ngắn trùng tên thực phẩm khi bỏ dấu: "giấm" = "giam", "giò" = "gio", "cá" = "ca", "quẩy" = "quay".
 */
export const RECEIPT_SKIP_SEED: SkipKeywordSeed[] = [
  { reason: "TAX", WORD: ["vat", "gtgt", "thue"] },
  { reason: "DISCOUNT", PREFIX: ["km", "ck", "voucher", "coupon", "uu dai", "discount", "promotion"], WORD: ["giam gia", "khuyen mai", "chiet khau"] },
  { reason: "TOTAL", PREFIX: ["tong", "tam tinh", "cong tien", "thanh tien", "phai tra", "can thanh toan", "so tien", "grand total", "sub total", "subtotal", "total", "amount"] },
  { reason: "PAYMENT", PREFIX: [
    "tien mat", "tien khach", "khach dua", "khach tra", "khach thanh toan", "tien thoi", "tien thua", "tra lai", "thoi lai", "chuyen khoan",
    "the", "visa", "master", "mastercard", "atm", "qr", "momo", "zalo pay", "zalopay", "vnpay", "shopee pay", "shopeepay", "thanh toan",
    "hinh thuc", "cash", "change", "card",
  ] },
  { reason: "BAG", LINE: ["tui", "bao bi"], LINE_SUFFIX: [
    "nilon", "ni lon", "nylon", "giay", "xop", "sinh hoc", "tu huy", "tu phan huy", "dung hang", "mua hang", "nho", "vua", "lon", "to",
  ] },
  { reason: "FEE", LINE: ["phi", "phu thu", "ship"], PREFIX: [
    "phi giao", "phi van chuyen", "phi dich vu", "phi ship", "phi phuc vu", "phi dong goi",
    "phu thu giao", "phu thu van chuyen", "phu thu dich vu", "phu thu ship", "phu thu phuc vu", "phu thu dong goi", "ship",
  ] },
  { reason: "POINTS", WORD: ["diem", "tich luy", "tich diem", "hang thanh vien", "ma thanh vien", "the thanh vien", "member", "ma kh"] },
  { reason: "HEADER", WORD: [
    "mst", "ma so thue", "dia chi", "hotline", "dien thoai", "sdt", "tel", "website", "www", "http", "https", "email", "hoa don",
    "phieu thanh toan", "phieu tinh tien", "so hd", "so ct", "so phieu", "chung tu", "ma hd", "ma don", "ma giao dich", "thu ngan",
    "nhan vien", "khach hang", "cam on", "hen gap lai", "doi tra", "ten hang", "don gia", "mat hang", "chi nhanh", "sieu thi",
    "cua hang", "store", "branch", "receipt", "invoice", "cashier", "ngay",
  ], PREFIX: ["dc", "dt", "nv", "bill"], LINE: ["quay", "quay so", "ban so"] },
];
