import type { DietType, FoodUnit, MealType } from "@prisma/client";

// Bộ công thức mẫu của Nouri. Mỗi công thức tính cho 1 khẩu phần (servings = 1) để số lượng nguyên liệu
// khớp với danh sách mua sắm. Năng lượng và chất dinh dưỡng là SỐ LIỆU ƯỚC TÍNH, tham khảo
// "Bảng thành phần thực phẩm Việt Nam" (Viện Dinh dưỡng, NXB Y học, 2007).

export type SeedIngredient = { name: string; quantity: number; unit: FoodUnit; optional?: boolean };
export type SeedRecipe = {
  slug: string; name: string; description: string; prepMinutes: number; cookMinutes: number;
  calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
  cuisine: SeedCuisine; dietTags: DietType[]; mealTypes: MealType[]; imageUrl: string;
  instructions: string[]; ingredients: SeedIngredient[];
};

export const seedCuisines = ["Việt Nam", "Nhật Bản", "Hàn Quốc", "Thái Lan", "Ý", "Hy Lạp", "Mỹ"] as const;
export type SeedCuisine = typeof seedCuisines[number];

// Ảnh tạm theo nhóm món; GĐ3 Admin sẽ upload ảnh thật vào imageUrl.
export const seedImageGroups = {
  grainBreakfast: "/assets/recipe-oats.jpg",
  seafood: "/assets/recipe-salmon.jpg",
  vegetarian: "/assets/recipe-vegan-bowl.jpg",
  meat: "/assets/nutrition-hero.jpg",
  drinkDessert: "/assets/community-smoothie.jpg",
} as const;

const g = (name: string, quantity: number, optional = false): SeedIngredient => ({ name, quantity, unit: "G", ...(optional ? { optional } : {}) });
const ml = (name: string, quantity: number): SeedIngredient => ({ name, quantity, unit: "ML" });
const item = (name: string, quantity: number): SeedIngredient => ({ name, quantity, unit: "ITEM" });
const img = seedImageGroups;

export const seedRecipes: SeedRecipe[] = [
  // ---------- Bữa sáng ----------
  {
    slug: "pho-bo", name: "Phở bò", cuisine: "Việt Nam",
    description: "Phở bò tái nước dùng xương ninh trong, thơm gừng nướng và hoa hồi.",
    prepMinutes: 20, cookMinutes: 100, calories: 480, proteinG: 30, carbsG: 62, fatG: 11, fiberG: 2,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["BREAKFAST", "LUNCH"], imageUrl: img.meat,
    instructions: [
      "Rửa sạch xương ống bò, chần trong nước sôi 3 phút rồi đổ bỏ nước đầu để nước dùng trong.",
      "Nướng gừng và hành tím trên lửa trực tiếp 3–4 phút đến khi cháy xém vỏ, cạo sạch; rang khô hoa hồi và quế 1 phút cho thơm.",
      "Cho xương vào nồi với 1,2 lít nước, thêm gừng, hành tím, hoa hồi, quế; ninh lửa nhỏ liu riu 90 phút, vớt bọt thường xuyên.",
      "Nêm nước dùng bằng nước mắm và muối; giữ sôi lăn tăn.",
      "Thái thịt bò thật mỏng ngược thớ; chần bánh phở trong nước sôi khoảng 10 giây rồi cho ra tô.",
      "Xếp thịt bò lên bánh phở, chan nước dùng đang sôi cho thịt tái; thêm hành lá, rau thơm và giá đỗ.",
    ],
    ingredients: [
      g("Xương ống bò", 300), g("Thịt bò", 100), g("Bánh phở", 200), g("Gừng", 20), g("Hành tím", 30),
      g("Hoa hồi", 2), g("Quế", 2), ml("Nước mắm", 15), g("Muối", 2), g("Hành lá", 15), g("Rau thơm", 20), g("Giá đỗ", 50),
    ],
  },
  {
    slug: "chao-ga-hanh-gung", name: "Cháo gà hành gừng", cuisine: "Việt Nam",
    description: "Cháo gạo nấu mềm với ức gà xé, gừng ấm bụng, dễ ăn buổi sáng.",
    prepMinutes: 10, cookMinutes: 40, calories: 330, proteinG: 28, carbsG: 40, fatG: 5, fiberG: 1,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["BREAKFAST"], imageUrl: img.grainBreakfast,
    instructions: [
      "Vo sạch gạo, để ráo rồi rang khô trên chảo lửa vừa 3 phút đến khi hạt hơi vàng.",
      "Luộc ức gà với 800 ml nước, vài lát gừng và hành tím đập dập trong 15 phút; vớt gà ra, giữ lại nước luộc.",
      "Cho gạo vào nước luộc gà, nấu lửa nhỏ 25 phút, khuấy đều để không bén đáy, đến khi hạt gạo nở bung.",
      "Xé nhỏ thịt gà, cho vào nồi cháo; nêm nước mắm cho vừa ăn.",
      "Múc cháo ra bát, rắc gừng thái sợi, hành lá và tiêu.",
    ],
    ingredients: [
      g("Gạo", 50), g("Ức gà", 100), g("Gừng", 15), g("Hành tím", 10), g("Hành lá", 10), ml("Nước mắm", 10), g("Tiêu", 1),
    ],
  },
  {
    slug: "banh-mi-op-la", name: "Bánh mì ốp la", cuisine: "Việt Nam",
    description: "Bánh mì nóng giòn với hai trứng ốp la, dưa leo và nước tương; không dùng pate hay chả.",
    prepMinutes: 5, cookMinutes: 8, calories: 410, proteinG: 18, carbsG: 45, fatG: 17, fiberG: 2,
    dietTags: ["BALANCED", "VEGETARIAN"], mealTypes: ["BREAKFAST"], imageUrl: img.grainBreakfast,
    instructions: [
      "Làm nóng bánh mì trong lò hoặc nồi chiên không dầu ở 180°C khoảng 3 phút cho vỏ giòn.",
      "Đun nóng dầu ăn trong chảo chống dính ở lửa vừa, đập hai quả trứng vào chảo.",
      "Chiên 3–4 phút đến khi lòng trắng chín, lòng đỏ còn hơi lòng đào; rắc chút tiêu.",
      "Thái dưa leo thành lát dài.",
      "Xẻ bánh mì, cho trứng và dưa leo vào, rưới nước tương rồi dùng nóng.",
    ],
    ingredients: [item("Bánh mì", 1), item("Trứng", 2), ml("Dầu ăn", 5), g("Dưa leo", 50), ml("Nước tương", 5), g("Tiêu", 1)],
  },
  {
    slug: "xoi-dau-xanh", name: "Xôi đậu xanh muối mè", cuisine: "Việt Nam",
    description: "Xôi nếp dẻo với đậu xanh bùi, hành phi bằng dầu thực vật và muối mè; thuần chay.",
    prepMinutes: 15, cookMinutes: 35, calories: 480, proteinG: 13, carbsG: 82, fatG: 13, fiberG: 4,
    dietTags: ["VEGETARIAN", "VEGAN"], mealTypes: ["BREAKFAST"], imageUrl: img.grainBreakfast,
    instructions: [
      "Ngâm gạo nếp và đậu xanh đã cà vỏ trong nước ít nhất 4 giờ (hoặc qua đêm), sau đó vo sạch và để ráo.",
      "Trộn gạo nếp với một nhúm muối, trộn đều với đậu xanh.",
      "Hấp cách thủy lửa lớn 25–30 phút; giữa chừng mở nắp, rưới 2 thìa nước và đảo đều cho xôi chín dẻo.",
      "Phi hành tím thái mỏng với dầu ăn ở lửa vừa 3–4 phút đến khi vàng giòn, vớt ra.",
      "Giã mè rang với chút muối; xới xôi ra đĩa, rưới dầu hành, rắc hành phi và muối mè.",
    ],
    ingredients: [g("Gạo nếp", 80), g("Đậu xanh", 30), g("Hành tím", 15), ml("Dầu ăn", 10), g("Mè rang", 5), g("Muối", 2)],
  },
  {
    slug: "banh-mi-dau-hu-sa", name: "Bánh mì đậu hũ sả", cuisine: "Việt Nam",
    description: "Bánh mì kẹp đậu hũ chiên sả ớt, đồ chua và rau mùi; thuần chay.",
    prepMinutes: 15, cookMinutes: 10, calories: 400, proteinG: 16, carbsG: 48, fatG: 16, fiberG: 3,
    dietTags: ["VEGETARIAN", "VEGAN"], mealTypes: ["BREAKFAST"], imageUrl: img.vegetarian,
    instructions: [
      "Cắt đậu hũ thành thanh dày 1 cm, thấm khô bằng khăn giấy.",
      "Băm nhuyễn sả và ớt; ướp đậu hũ với một nửa phần sả ớt và nước tương trong 10 phút.",
      "Đun nóng dầu ăn ở lửa vừa, chiên đậu hũ mỗi mặt 2–3 phút đến khi vàng; cho phần sả còn lại vào phi thơm 1 phút.",
      "Bào sợi cà rốt, thái lát dưa leo; làm nóng bánh mì ở 180°C khoảng 3 phút.",
      "Xẻ bánh mì, kẹp đậu hũ sả, cà rốt, dưa leo và rau mùi.",
    ],
    ingredients: [
      item("Bánh mì", 1), g("Đậu hũ", 120), g("Sả", 15), g("Ớt", 3, true), ml("Nước tương", 10), ml("Dầu ăn", 10),
      g("Cà rốt", 30), g("Dưa leo", 40), g("Rau mùi", 5),
    ],
  },
  {
    slug: "trung-chien-rau-cu", name: "Trứng chiên rau củ", cuisine: "Việt Nam",
    description: "Trứng chiên dày với cà rốt, nấm và hành lá; nhiều đạm, ít tinh bột.",
    prepMinutes: 8, cookMinutes: 10, calories: 290, proteinG: 21, carbsG: 7, fatG: 20, fiberG: 2,
    dietTags: ["VEGETARIAN", "LOW_CARB", "HIGH_PROTEIN"], mealTypes: ["BREAKFAST", "DINNER"], imageUrl: img.grainBreakfast,
    instructions: [
      "Bào sợi cà rốt, thái mỏng nấm rơm, cắt nhỏ hành lá.",
      "Đánh tan trứng với nước tương và tiêu, cho rau củ vào trộn đều.",
      "Đun nóng dầu ăn trong chảo chống dính ở lửa vừa nhỏ, đổ hỗn hợp trứng vào, dàn đều.",
      "Đậy nắp chiên 5 phút đến khi mặt dưới vàng, lật mặt chiên thêm 2–3 phút cho chín đều.",
    ],
    ingredients: [item("Trứng", 3), g("Cà rốt", 40), g("Nấm rơm", 50), g("Hành lá", 10), ml("Nước tương", 5), ml("Dầu ăn", 5), g("Tiêu", 1)],
  },
  {
    slug: "yen-mach-qua-dem", name: "Yến mạch qua đêm sữa chua chuối", cuisine: "Mỹ",
    description: "Overnight oats chuẩn bị từ tối hôm trước, sáng ra chỉ cần thêm chuối.",
    prepMinutes: 8, cookMinutes: 0, calories: 430, proteinG: 16, carbsG: 72, fatG: 10, fiberG: 7,
    dietTags: ["BALANCED", "VEGETARIAN"], mealTypes: ["BREAKFAST"], imageUrl: img.grainBreakfast,
    instructions: [
      "Cho yến mạch cán dẹt vào hũ thủy tinh có nắp.",
      "Thêm sữa chua, sữa tươi và mật ong, khuấy đều để yến mạch ngập hoàn toàn.",
      "Đậy nắp, để ngăn mát tủ lạnh (khoảng 4°C) ít nhất 6 giờ hoặc qua đêm.",
      "Sáng hôm sau khuấy lại, thêm chuối thái lát lên trên và dùng lạnh.",
    ],
    ingredients: [g("Yến mạch", 50), g("Sữa chua", 100), ml("Sữa tươi", 120), item("Chuối", 1), g("Mật ong", 10)],
  },
  {
    slug: "sua-dau-nanh", name: "Sữa đậu nành", cuisine: "Việt Nam",
    description: "Sữa đậu nành tự nấu thơm lá dứa, ngọt nhẹ; thuần chay.",
    prepMinutes: 15, cookMinutes: 15, calories: 200, proteinG: 14, carbsG: 16, fatG: 7, fiberG: 1,
    dietTags: ["BALANCED", "VEGETARIAN", "VEGAN"], mealTypes: ["BREAKFAST", "SNACK"], imageUrl: img.drinkDessert,
    instructions: [
      "Ngâm đậu nành trong nước 8 giờ, sau đó chà bớt vỏ và rửa sạch.",
      "Xay đậu với 500 ml nước trong 2 phút cho thật mịn.",
      "Lọc hỗn hợp qua túi vải, vắt kiệt lấy nước sữa, bỏ bã.",
      "Đun sữa cùng lá dứa ở lửa vừa, khuấy liên tục để không trào; khi sôi hạ lửa nhỏ nấu thêm 10 phút.",
      "Vớt lá dứa, thêm đường khuấy tan; dùng nóng hoặc để nguội rồi cho vào tủ lạnh.",
    ],
    ingredients: [g("Đậu nành", 40), g("Đường", 10), g("Lá dứa", 5)],
  },
  {
    slug: "bun-xao-chay", name: "Bún xào chay", cuisine: "Việt Nam",
    description: "Bún xào với đậu hũ, nấm và rau cải, nêm nước tương; thuần chay.",
    prepMinutes: 15, cookMinutes: 12, calories: 460, proteinG: 17, carbsG: 70, fatG: 13, fiberG: 5,
    dietTags: ["BALANCED", "VEGETARIAN", "VEGAN"], mealTypes: ["BREAKFAST", "LUNCH"], imageUrl: img.vegetarian,
    instructions: [
      "Cắt đậu hũ thành miếng vuông nhỏ; thái sợi cà rốt, cắt khúc cải thìa, thái đôi nấm rơm.",
      "Chiên đậu hũ với một nửa lượng dầu ở lửa vừa 5 phút đến khi vàng các mặt, để riêng.",
      "Cho phần dầu còn lại vào chảo, xào cà rốt và nấm 2 phút ở lửa lớn, thêm cải thìa xào 1 phút.",
      "Cho bún và đậu hũ vào, rưới nước tương, đảo nhanh tay 2–3 phút cho bún thấm đều.",
      "Rắc tiêu, tắt bếp và dùng nóng.",
    ],
    ingredients: [
      g("Bún tươi", 200), g("Đậu hũ", 100), g("Nấm rơm", 60), g("Cà rốt", 40), g("Cải thìa", 80),
      ml("Nước tương", 15), ml("Dầu ăn", 10), g("Tiêu", 1),
    ],
  },

  // ---------- Bữa trưa / tối: món mặn ----------
  {
    slug: "com-tam-suon-nuong", name: "Cơm tấm sườn nướng", cuisine: "Việt Nam",
    description: "Cơm tấm với sườn heo ướp nướng thơm, mỡ hành dầu, dưa leo, cà chua và nước mắm pha.",
    prepMinutes: 20, cookMinutes: 30, calories: 650, proteinG: 32, carbsG: 78, fatG: 22, fiberG: 2,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["LUNCH"], imageUrl: img.meat,
    instructions: [
      "Băm tỏi và hành tím; ướp sườn với một nửa nước mắm, đường, tỏi, hành tím trong ít nhất 30 phút.",
      "Vo gạo tấm, nấu với lượng nước bằng 1,1 lần gạo khoảng 20 phút cho cơm tơi.",
      "Nướng sườn trong lò hoặc nồi chiên không dầu ở 200°C khoảng 20 phút, lật mặt giữa chừng đến khi xém cạnh.",
      "Phi hành lá với dầu ăn nóng để làm mỡ hành; thái lát dưa leo và cà chua.",
      "Pha phần nước mắm còn lại với chút đường và nước ấm; xếp cơm, sườn, rưới mỡ hành, dùng kèm nước mắm.",
    ],
    ingredients: [
      g("Gạo tấm", 80), g("Sườn heo", 150), ml("Nước mắm", 20), g("Đường", 10), g("Tỏi", 5), g("Hành tím", 10),
      g("Hành lá", 10), ml("Dầu ăn", 5), g("Dưa leo", 50), g("Cà chua", 50),
    ],
  },
  {
    slug: "thit-kho-trung", name: "Thịt kho trứng (kèm cơm)", cuisine: "Việt Nam",
    description: "Thịt ba chỉ kho nước dừa với trứng, đậm đà kiểu miền Nam, ăn cùng cơm trắng.",
    prepMinutes: 15, cookMinutes: 60, calories: 640, proteinG: 26, carbsG: 58, fatG: 33, fiberG: 1,
    dietTags: ["BALANCED"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.meat,
    instructions: [
      "Luộc trứng 10 phút, ngâm nước lạnh rồi bóc vỏ.",
      "Cắt thịt ba chỉ miếng vuông 3 cm, ướp với nước mắm, đường, tỏi và hành tím băm trong 20 phút.",
      "Cho thịt vào nồi, đảo lửa vừa 5 phút cho săn và ra bớt mỡ.",
      "Đổ nước dừa ngập thịt, đun sôi rồi hạ lửa nhỏ, vớt bọt; kho 40 phút.",
      "Cho trứng vào kho thêm 15 phút đến khi nước sánh và thịt mềm; dùng với cơm nấu từ gạo.",
    ],
    ingredients: [
      g("Thịt ba chỉ", 100), item("Trứng", 1), ml("Nước dừa", 150), ml("Nước mắm", 15), g("Đường", 5),
      g("Tỏi", 5), g("Hành tím", 10), g("Gạo", 70),
    ],
  },
  {
    slug: "ca-kho-to", name: "Cá kho tộ (kèm cơm)", cuisine: "Việt Nam",
    description: "Cá basa kho tộ nước màu, tiêu và ớt, mặn ngọt vừa phải, ăn cùng cơm.",
    prepMinutes: 15, cookMinutes: 35, calories: 520, proteinG: 30, carbsG: 62, fatG: 15, fiberG: 1,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.seafood,
    instructions: [
      "Làm sạch cá basa, cắt khúc dày 3 cm, chà muối rồi rửa lại để bớt tanh.",
      "Ướp cá với nước mắm, một nửa lượng đường, hành tím, tỏi băm và tiêu trong 15 phút.",
      "Thắng phần đường còn lại với dầu ăn ở lửa nhỏ 2–3 phút đến khi chuyển màu cánh gián.",
      "Xếp cá vào nồi đất, đổ nước màu và 100 ml nước, đun sôi rồi hạ lửa nhỏ kho 25 phút, thỉnh thoảng rưới nước lên cá.",
      "Khi nước kho sệt lại, thêm ớt, hành lá và rắc tiêu; ăn cùng cơm.",
    ],
    ingredients: [
      g("Cá basa", 150), ml("Nước mắm", 15), g("Đường", 10), g("Hành tím", 10), g("Tỏi", 5), g("Tiêu", 1),
      ml("Dầu ăn", 5), g("Ớt", 3, true), g("Hành lá", 5), g("Gạo", 70),
    ],
  },
  {
    slug: "canh-chua-ca-loc", name: "Canh chua cá lóc (kèm cơm)", cuisine: "Việt Nam",
    description: "Canh chua miền Tây với cá lóc, thơm, cà chua, đậu bắp và bạc hà.",
    prepMinutes: 20, cookMinutes: 20, calories: 470, proteinG: 32, carbsG: 70, fatG: 5, fiberG: 4,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.seafood,
    instructions: [
      "Làm sạch cá lóc, cắt khúc; ngâm me chua với 50 ml nước nóng rồi lọc lấy nước.",
      "Cắt miếng thơm, cà chua múi cau, đậu bắp xéo; tước vỏ bạc hà, cắt khúc; rửa giá đỗ.",
      "Đun sôi 700 ml nước, cho thơm và nước me vào nấu 5 phút.",
      "Thả cá vào nấu lửa vừa 8 phút đến khi cá chín, vớt bọt; nêm nước mắm và đường.",
      "Cho cà chua, đậu bắp, bạc hà nấu thêm 2 phút, tắt bếp rồi thêm giá đỗ và ngò om; ăn cùng cơm.",
    ],
    ingredients: [
      g("Cá lóc", 150), g("Thơm", 80), g("Cà chua", 100), g("Đậu bắp", 50), g("Bạc hà", 60), g("Giá đỗ", 50),
      g("Me chua", 20), g("Ngò om", 5), ml("Nước mắm", 15), g("Đường", 10), g("Gạo", 70),
    ],
  },
  {
    slug: "ga-xao-sa-ot", name: "Gà xào sả ớt (kèm cơm)", cuisine: "Việt Nam",
    description: "Đùi gà xào sả ớt thơm cay, săn chắc, ăn cùng cơm nóng.",
    prepMinutes: 15, cookMinutes: 15, calories: 600, proteinG: 34, carbsG: 60, fatG: 24, fiberG: 2,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.meat,
    instructions: [
      "Rút xương đùi gà, cắt miếng vừa ăn; băm nhuyễn sả, tỏi, hành tím; thái ớt.",
      "Ướp gà với nước mắm, đường và một nửa phần sả băm trong 15 phút.",
      "Phi thơm tỏi, hành tím và sả còn lại với dầu ăn ở lửa vừa khoảng 1 phút.",
      "Cho gà vào xào lửa lớn 8–10 phút đến khi săn và vàng cạnh, thêm ớt đảo đều 1 phút.",
      "Nêm lại cho vừa ăn, dùng nóng với cơm.",
    ],
    ingredients: [
      g("Đùi gà", 150), g("Sả", 30), g("Ớt", 5, true), g("Tỏi", 5), g("Hành tím", 10), ml("Nước mắm", 10),
      g("Đường", 5), ml("Dầu ăn", 10), g("Gạo", 70),
    ],
  },
  {
    slug: "canh-bi-do-tom", name: "Canh bí đỏ nấu tôm (kèm cơm)", cuisine: "Việt Nam",
    description: "Canh bí đỏ ngọt bùi nấu tôm tươi, nhẹ bụng, ăn cùng cơm.",
    prepMinutes: 12, cookMinutes: 18, calories: 420, proteinG: 24, carbsG: 68, fatG: 6, fiberG: 3,
    dietTags: ["BALANCED"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.seafood,
    instructions: [
      "Gọt vỏ bí đỏ, cắt miếng vuông 2 cm; bóc vỏ tôm, rút chỉ, băm sơ.",
      "Phi hành tím với dầu ăn đến thơm, cho tôm vào xào 2 phút đến khi chuyển đỏ.",
      "Thêm 600 ml nước, đun sôi rồi cho bí đỏ vào nấu lửa vừa 12–15 phút đến khi bí mềm.",
      "Nêm nước mắm, thêm hành lá và tiêu rồi tắt bếp; ăn cùng cơm.",
    ],
    ingredients: [g("Bí đỏ", 200), g("Tôm", 100), g("Hành tím", 5), ml("Dầu ăn", 5), ml("Nước mắm", 10), g("Hành lá", 10), g("Tiêu", 1), g("Gạo", 70)],
  },
  {
    slug: "bun-cha-ha-noi", name: "Bún chả Hà Nội", cuisine: "Việt Nam",
    description: "Chả viên và thịt ba chỉ nướng than, chan nước mắm chua ngọt với đu đủ xanh, ăn kèm bún và rau sống.",
    prepMinutes: 30, cookMinutes: 20, calories: 640, proteinG: 30, carbsG: 72, fatG: 26, fiberG: 3,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["LUNCH"], imageUrl: img.meat,
    instructions: [
      "Băm tỏi, hành tím; ướp thịt heo xay và thịt ba chỉ thái mỏng với một nửa nước mắm, một nửa đường, tỏi, hành tím trong 30 phút.",
      "Vo thịt xay thành viên dẹt; nướng cả chả viên và thịt ba chỉ ở 200°C khoảng 15–20 phút, lật mặt giữa chừng.",
      "Pha nước chấm: phần nước mắm, đường còn lại với giấm và 100 ml nước ấm, khuấy tan, thêm ớt băm.",
      "Thái mỏng đu đủ xanh và cà rốt, ngâm vào nước chấm.",
      "Cho chả nướng vào bát nước chấm; dùng cùng bún tươi, xà lách và rau thơm.",
    ],
    ingredients: [
      g("Bún tươi", 200), g("Thịt heo xay", 80), g("Thịt ba chỉ", 60), ml("Nước mắm", 20), g("Đường", 15), ml("Giấm", 10),
      g("Tỏi", 5), g("Hành tím", 10), g("Ớt", 3, true), g("Đu đủ xanh", 50), g("Cà rốt", 30), g("Xà lách", 50), g("Rau thơm", 20),
    ],
  },
  {
    slug: "bun-bo-nam-bo", name: "Bún bò Nam Bộ", cuisine: "Việt Nam",
    description: "Bún trộn thịt bò xào sả, rau sống, hành phi và đậu phộng rang, chan nước mắm pha.",
    prepMinutes: 20, cookMinutes: 10, calories: 580, proteinG: 35, carbsG: 66, fatG: 19, fiberG: 4,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["LUNCH"], imageUrl: img.meat,
    instructions: [
      "Thái mỏng thịt bò, ướp với sả băm, tỏi băm và một nửa nước mắm trong 15 phút.",
      "Phi hành tím thái mỏng với dầu ăn ở lửa vừa đến khi vàng giòn, vớt ra; giã dập đậu phộng rang.",
      "Dùng dầu còn lại trong chảo xào bò ở lửa lớn 2–3 phút đến khi vừa chín tới.",
      "Pha nước mắm còn lại với đường và 60 ml nước ấm.",
      "Xếp xà lách, rau thơm, dưa leo, giá đỗ và bún vào tô, thêm bò xào, hành phi, đậu phộng; chan nước mắm rồi trộn đều.",
    ],
    ingredients: [
      g("Bún tươi", 200), g("Thịt bò", 120), g("Sả", 10), g("Tỏi", 5), ml("Nước mắm", 20), g("Đường", 10), g("Hành tím", 15),
      ml("Dầu ăn", 10), g("Đậu phộng", 15), g("Xà lách", 50), g("Rau thơm", 15), g("Dưa leo", 50), g("Giá đỗ", 50),
    ],
  },
  {
    slug: "bo-xao-bong-cai", name: "Bò xào bông cải", cuisine: "Việt Nam",
    description: "Thịt bò mềm xào bông cải xanh và cà rốt, không kèm cơm để giảm tinh bột.",
    prepMinutes: 15, cookMinutes: 10, calories: 360, proteinG: 38, carbsG: 14, fatG: 17, fiberG: 6,
    dietTags: ["LOW_CARB", "HIGH_PROTEIN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.meat,
    instructions: [
      "Thái mỏng thịt bò, ướp với một nửa nước tương, tỏi băm và tiêu trong 10 phút.",
      "Cắt bông cải xanh thành từng nhánh nhỏ, thái lát cà rốt; chần cả hai trong nước sôi 1 phút rồi vớt ra.",
      "Đun nóng dầu ăn ở lửa lớn, xào bò 1–2 phút đến khi vừa tái thì trút ra đĩa.",
      "Cho bông cải và cà rốt vào chảo xào 2 phút, thêm phần nước tương còn lại.",
      "Đổ bò vào đảo nhanh 30 giây cho nóng đều, tắt bếp và dùng ngay.",
    ],
    ingredients: [g("Thịt bò", 150), g("Bông cải xanh", 200), g("Cà rốt", 50), g("Tỏi", 10), ml("Nước tương", 15), ml("Dầu ăn", 10), g("Tiêu", 1)],
  },
  {
    slug: "ca-hap-gung-hanh", name: "Cá hấp gừng hành, rau luộc", cuisine: "Việt Nam",
    description: "Cá diêu hồng hấp gừng hành, rưới nước tương, ăn kèm cải ngọt luộc; ít tinh bột.",
    prepMinutes: 15, cookMinutes: 20, calories: 300, proteinG: 38, carbsG: 8, fatG: 12, fiberG: 4,
    dietTags: ["LOW_CARB", "HIGH_PROTEIN"], mealTypes: ["DINNER"], imageUrl: img.seafood,
    instructions: [
      "Làm sạch cá diêu hồng, khứa vài đường trên thân, thấm khô.",
      "Thái sợi gừng, cắt khúc hành lá; lót một nửa gừng hành xuống đĩa, đặt cá lên và rải phần còn lại trên mặt.",
      "Hấp cách thủy lửa lớn 12–15 phút đến khi thịt cá trắng đục, chạm đũa thấy chín tới xương.",
      "Đun nóng dầu ăn, rưới lên cá cùng nước tương.",
      "Luộc cải ngọt trong nước sôi có chút muối 2 phút; dùng kèm cá.",
    ],
    ingredients: [g("Cá diêu hồng", 200), g("Gừng", 20), g("Hành lá", 20), ml("Nước tương", 15), ml("Dầu ăn", 5), g("Cải ngọt", 200), g("Muối", 1)],
  },

  // ---------- Bữa trưa / tối: món chay ----------
  {
    slug: "dau-hu-sot-ca-chua", name: "Đậu hũ sốt cà chua (kèm cơm)", cuisine: "Việt Nam",
    description: "Đậu hũ chiên sốt cà chua chua ngọt, nêm nước tương; thuần chay, ăn cùng cơm.",
    prepMinutes: 10, cookMinutes: 15, calories: 560, proteinG: 22, carbsG: 66, fatG: 22, fiberG: 4,
    dietTags: ["BALANCED", "VEGETARIAN", "VEGAN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.vegetarian,
    instructions: [
      "Cắt đậu hũ miếng vuông, thấm khô; cà chua bỏ hạt, thái hạt lựu; cắt nhỏ hành lá.",
      "Chiên đậu hũ với dầu ăn ở lửa vừa 5–6 phút đến khi vàng đều các mặt, vớt ra.",
      "Để lại ít dầu trong chảo, xào cà chua 4–5 phút cho mềm và ra nước sốt, thêm nước tương và đường.",
      "Cho đậu hũ vào, đảo nhẹ cho sốt bám đều, đun nhỏ lửa 3 phút.",
      "Rắc hành lá, tắt bếp và dùng với cơm.",
    ],
    ingredients: [g("Đậu hũ", 200), g("Cà chua", 150), g("Hành lá", 10), ml("Nước tương", 15), g("Đường", 5), ml("Dầu ăn", 10), g("Gạo", 70)],
  },
  {
    slug: "canh-chua-chay", name: "Canh chua chay (kèm cơm)", cuisine: "Việt Nam",
    description: "Canh chua với đậu hũ, nấm rơm, thơm, cà chua và bạc hà, nêm nước tương; thuần chay.",
    prepMinutes: 20, cookMinutes: 15, calories: 440, proteinG: 17, carbsG: 74, fatG: 9, fiberG: 6,
    dietTags: ["VEGETARIAN", "VEGAN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.vegetarian,
    instructions: [
      "Ngâm me chua với 50 ml nước nóng, lọc lấy nước; cắt đậu hũ miếng vừa, chiên sơ với dầu ăn 3 phút.",
      "Cắt thơm, cà chua, đậu bắp; tước vỏ bạc hà cắt khúc; làm sạch nấm rơm.",
      "Đun sôi 700 ml nước với thơm và nước me trong 5 phút.",
      "Cho nấm rơm và đậu hũ vào nấu 4 phút; nêm nước tương và đường.",
      "Thêm cà chua, đậu bắp, bạc hà nấu 2 phút, tắt bếp rồi cho giá đỗ và ngò om; ăn cùng cơm.",
    ],
    ingredients: [
      g("Đậu hũ", 100), g("Nấm rơm", 80), g("Thơm", 80), g("Cà chua", 100), g("Đậu bắp", 50), g("Bạc hà", 60), g("Giá đỗ", 50),
      g("Me chua", 20), g("Ngò om", 5), ml("Nước tương", 20), g("Đường", 10), ml("Dầu ăn", 5), g("Gạo", 70),
    ],
  },
  {
    slug: "nam-kho-tieu", name: "Nấm kho tiêu (kèm cơm)", cuisine: "Việt Nam",
    description: "Nấm đông cô và nấm bào ngư kho tiêu đậm vị, nêm nước tương; thuần chay.",
    prepMinutes: 10, cookMinutes: 20, calories: 420, proteinG: 12, carbsG: 72, fatG: 11, fiberG: 6,
    dietTags: ["VEGETARIAN", "VEGAN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.vegetarian,
    instructions: [
      "Rửa sạch nấm đông cô và nấm bào ngư, vắt ráo; xé nấm bào ngư thành sợi to.",
      "Đun nóng dầu ăn ở lửa vừa, xào nấm 3 phút cho săn lại.",
      "Thêm nước tương, đường và 80 ml nước, đun sôi rồi hạ lửa nhỏ kho 12–15 phút đến khi nước sệt lại.",
      "Rắc tiêu xay và ớt thái lát, đảo đều 1 phút rồi tắt bếp; ăn cùng cơm.",
    ],
    ingredients: [g("Nấm đông cô", 150), g("Nấm bào ngư", 100), ml("Nước tương", 20), g("Đường", 10), ml("Dầu ăn", 10), g("Tiêu", 2), g("Ớt", 3, true), g("Gạo", 70)],
  },
  {
    slug: "com-chien-chay", name: "Cơm chiên chay rau củ nấm", cuisine: "Việt Nam",
    description: "Cơm chiên tơi hạt với cà rốt, đậu Hà Lan, bắp và nấm, nêm nước tương; thuần chay.",
    prepMinutes: 15, cookMinutes: 12, calories: 540, proteinG: 13, carbsG: 88, fatG: 16, fiberG: 6,
    dietTags: ["VEGETARIAN", "VEGAN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.vegetarian,
    instructions: [
      "Nấu cơm từ gạo và để nguội hẳn (tốt nhất cơm để ngăn mát từ hôm trước) để khi chiên không bị nát.",
      "Thái hạt lựu cà rốt và nấm rơm; chần cà rốt, đậu Hà Lan và bắp ngọt trong nước sôi 2 phút.",
      "Đun nóng dầu ăn ở lửa lớn, xào nấm 2 phút, thêm rau củ đã chần xào tiếp 1 phút.",
      "Cho cơm vào, dùng muôi tán đều và đảo liên tục 4–5 phút đến khi hạt cơm săn.",
      "Rưới nước tương quanh thành chảo, đảo đều, thêm hành lá rồi tắt bếp.",
    ],
    ingredients: [g("Gạo", 80), g("Cà rốt", 40), g("Đậu Hà Lan", 40), g("Bắp ngọt", 40), g("Nấm rơm", 50), g("Hành lá", 10), ml("Nước tương", 15), ml("Dầu ăn", 15)],
  },

  // ---------- Món nước ngoài ----------
  {
    slug: "mi-y-sot-bo-bam", name: "Mì Ý sốt bò bằm", cuisine: "Ý",
    description: "Spaghetti sốt bò bằm cà chua kiểu Bolognese đơn giản tại nhà.",
    prepMinutes: 10, cookMinutes: 30, calories: 660, proteinG: 34, carbsG: 76, fatG: 24, fiberG: 5,
    dietTags: ["BALANCED"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.meat,
    instructions: [
      "Băm nhỏ hành tây và tỏi; cà chua thái hạt lựu.",
      "Phi hành tây và tỏi với dầu ô liu ở lửa vừa 3 phút đến khi mềm thơm.",
      "Cho thịt bò xay vào xào 5 phút đến khi săn, dùng muôi tán tơi.",
      "Thêm cà chua, muối, tiêu và 100 ml nước; đun liu riu 20 phút đến khi sốt sệt.",
      "Luộc mì Ý trong nước sôi có muối 9–10 phút (theo hướng dẫn trên gói), vớt ra, trộn hoặc rưới sốt lên trên.",
    ],
    ingredients: [g("Mì Ý", 90), g("Thịt bò xay", 100), g("Cà chua", 150), g("Hành tây", 50), g("Tỏi", 10), ml("Dầu ô liu", 10), g("Muối", 2), g("Tiêu", 1)],
  },
  {
    slug: "ga-teriyaki", name: "Gà teriyaki (kèm cơm)", cuisine: "Nhật Bản",
    description: "Đùi gà áp chảo sốt teriyaki tự làm từ nước tương, mật ong và gừng, ăn cùng cơm và bông cải.",
    prepMinutes: 10, cookMinutes: 20, calories: 620, proteinG: 36, carbsG: 75, fatG: 17, fiberG: 3,
    dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.meat,
    instructions: [
      "Pha sốt teriyaki: nước tương, mật ong, gừng và tỏi băm với 30 ml nước.",
      "Rút xương đùi gà, để nguyên miếng, thấm khô da.",
      "Áp chảo gà với dầu ăn, đặt mặt da xuống, lửa vừa 6–7 phút đến khi da vàng giòn; lật mặt áp thêm 5 phút.",
      "Đổ sốt vào chảo, đun lửa nhỏ 3–4 phút, liên tục rưới sốt lên gà đến khi sốt sánh bóng.",
      "Hấp bông cải xanh 3 phút; thái gà, rắc mè rang, dùng cùng cơm và bông cải.",
    ],
    ingredients: [
      g("Đùi gà", 150), ml("Nước tương", 20), g("Mật ong", 15), g("Gừng", 10), g("Tỏi", 5), ml("Dầu ăn", 5),
      g("Mè rang", 3), g("Bông cải xanh", 100), g("Gạo", 70),
    ],
  },
  {
    slug: "com-tron-han-quoc", name: "Cơm trộn Hàn Quốc (bibimbap)", cuisine: "Hàn Quốc",
    description: "Cơm trộn rau củ xào, trứng ốp la và tương ớt Hàn Quốc; không dùng thịt.",
    prepMinutes: 20, cookMinutes: 15, calories: 520, proteinG: 17, carbsG: 78, fatG: 15, fiberG: 6,
    dietTags: ["BALANCED", "VEGETARIAN"], mealTypes: ["LUNCH"], imageUrl: img.vegetarian,
    instructions: [
      "Chần rau cải bó xôi và giá đỗ trong nước sôi 1 phút, vắt ráo, trộn mỗi loại với chút dầu mè.",
      "Thái sợi cà rốt, dưa leo và nấm đông cô; xào cà rốt và nấm với dầu ăn ở lửa vừa 2 phút.",
      "Ốp la trứng ở lửa vừa khoảng 3 phút, giữ lòng đỏ còn mềm.",
      "Cho cơm nóng vào tô, xếp từng loại rau quanh mặt cơm, đặt trứng ở giữa.",
      "Thêm tương ớt Hàn Quốc, rắc mè rang, trộn đều trước khi ăn.",
    ],
    ingredients: [
      g("Gạo", 70), item("Trứng", 1), g("Rau cải bó xôi", 80), g("Giá đỗ", 50), g("Cà rốt", 40), g("Nấm đông cô", 50),
      g("Dưa leo", 40), g("Tương ớt Hàn Quốc", 15), ml("Dầu mè", 5), ml("Dầu ăn", 5), g("Mè rang", 3),
    ],
  },
  {
    slug: "pad-thai-tom", name: "Pad Thái tôm", cuisine: "Thái Lan",
    description: "Bánh phở xào kiểu Thái với tôm, trứng, đậu hũ, giá, hẹ và đậu phộng, sốt me chua ngọt.",
    prepMinutes: 20, cookMinutes: 12, calories: 640, proteinG: 32, carbsG: 80, fatG: 22, fiberG: 3,
    dietTags: ["BALANCED"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.seafood,
    instructions: [
      "Pha sốt: dầm me chua với 40 ml nước nóng, lọc lấy nước, khuấy cùng nước mắm và đường.",
      "Bóc vỏ tôm, rút chỉ; cắt đậu hũ hạt lựu; cắt khúc hẹ; rang và giã dập đậu phộng.",
      "Đun nóng dầu ăn ở lửa lớn, chiên đậu hũ 2 phút, cho tôm vào xào 2 phút đến khi đỏ.",
      "Đẩy tôm sang một bên, đập trứng vào chảo đánh tơi, rồi cho bánh phở và sốt me vào đảo đều 3 phút.",
      "Thêm giá đỗ và hẹ đảo 30 giây, tắt bếp; rắc đậu phộng, vắt chanh khi ăn.",
    ],
    ingredients: [
      g("Bánh phở", 150), g("Tôm", 100), item("Trứng", 1), g("Đậu hũ", 50), g("Giá đỗ", 50), g("Hẹ", 20), g("Đậu phộng", 15),
      g("Me chua", 20), ml("Nước mắm", 15), g("Đường", 10), ml("Dầu ăn", 10), item("Chanh", 1),
    ],
  },
  {
    slug: "salad-hy-lap", name: "Salad Hy Lạp phô mai feta", cuisine: "Hy Lạp",
    description: "Salad dưa leo, cà chua, ớt chuông, ô liu và phô mai feta trộn dầu ô liu; ít tinh bột.",
    prepMinutes: 15, cookMinutes: 0, calories: 390, proteinG: 12, carbsG: 18, fatG: 31, fiberG: 5,
    dietTags: ["VEGETARIAN", "LOW_CARB"], mealTypes: ["LUNCH", "DINNER"], imageUrl: img.vegetarian,
    instructions: [
      "Rửa sạch rau củ; cắt dưa leo và cà chua miếng vừa ăn, thái sợi ớt chuông và hành tây.",
      "Ngâm hành tây trong nước lạnh 5 phút để bớt hăng, vớt ra để ráo.",
      "Pha sốt: dầu ô liu, giấm và lá oregano khô, khuấy đều.",
      "Cho rau củ và ô liu đen vào tô lớn, rưới sốt, trộn nhẹ tay.",
      "Đặt phô mai feta cắt khối lên trên, dùng ngay khi rau còn giòn.",
    ],
    ingredients: [
      g("Dưa leo", 150), g("Cà chua", 150), g("Ớt chuông", 80), g("Hành tây", 40), g("Ô liu đen", 30),
      g("Phô mai feta", 60), ml("Dầu ô liu", 15), ml("Giấm", 10), g("Lá oregano khô", 1),
    ],
  },

  // ---------- Bữa phụ ----------
  {
    slug: "goi-cuon-tom-thit", name: "Gỏi cuốn tôm thịt", cuisine: "Việt Nam",
    description: "Hai cuốn bánh tráng với tôm, thịt luộc, bún và rau sống, chấm tương đen đậu phộng.",
    prepMinutes: 25, cookMinutes: 10, calories: 320, proteinG: 20, carbsG: 42, fatG: 8, fiberG: 2,
    dietTags: ["BALANCED"], mealTypes: ["SNACK", "LUNCH"], imageUrl: img.seafood,
    instructions: [
      "Luộc thịt heo nạc 12 phút, để nguội rồi thái mỏng; luộc tôm 2–3 phút, bóc vỏ và chẻ đôi.",
      "Rửa sạch xà lách, rau thơm và hẹ, để ráo.",
      "Nhúng nhanh bánh tráng qua nước, trải ra; xếp xà lách, bún, rau thơm, thịt, tôm rồi cuộn chặt tay, cài cọng hẹ.",
      "Pha nước chấm: tương đen khuấy với chút nước ấm, đun sôi 1 phút, rắc đậu phộng giã dập.",
    ],
    ingredients: [
      g("Bánh tráng", 20), g("Bún tươi", 60), g("Tôm", 50), g("Thịt heo nạc", 40), g("Xà lách", 30), g("Rau thơm", 10),
      g("Hẹ", 5), g("Tương đen", 15), g("Đậu phộng", 8),
    ],
  },
  {
    slug: "che-dau-den", name: "Chè đậu đen", cuisine: "Việt Nam",
    description: "Chè đậu đen nấu nhừ, ngọt thanh, ăn kèm nước cốt dừa; thuần chay.",
    prepMinutes: 10, cookMinutes: 50, calories: 270, proteinG: 9, carbsG: 46, fatG: 6, fiberG: 5,
    dietTags: ["VEGETARIAN", "VEGAN"], mealTypes: ["SNACK"], imageUrl: img.drinkDessert,
    instructions: [
      "Ngâm đậu đen trong nước 4 giờ, đãi sạch và bỏ hạt lép.",
      "Nấu đậu với 600 ml nước, sôi thì hạ lửa nhỏ, ninh 40 phút đến khi hạt nở mềm nhưng còn nguyên.",
      "Thêm đường và một nhúm muối, nấu thêm 10 phút cho thấm.",
      "Đun ấm nước cốt dừa với chút muối; múc chè ra chén và rưới nước cốt dừa, dùng nóng hoặc lạnh.",
    ],
    ingredients: [g("Đậu đen", 40), g("Đường", 20), ml("Nước cốt dừa", 30), g("Muối", 1)],
  },
  {
    slug: "sua-chua-nep-cam", name: "Sữa chua nếp cẩm", cuisine: "Việt Nam",
    description: "Nếp cẩm nấu dẻo trộn sữa chua mát lạnh, chua ngọt hài hòa.",
    prepMinutes: 10, cookMinutes: 40, calories: 260, proteinG: 7, carbsG: 48, fatG: 3, fiberG: 2,
    dietTags: ["VEGETARIAN"], mealTypes: ["SNACK"], imageUrl: img.drinkDessert,
    instructions: [
      "Ngâm nếp cẩm 6 giờ, vo sạch.",
      "Nấu nếp cẩm với 300 ml nước ở lửa nhỏ 35 phút, khuấy đều đến khi hạt chín mềm và sánh.",
      "Thêm đường, khuấy tan rồi để nguội; cất ngăn mát.",
      "Múc nếp cẩm ra ly, thêm sữa chua lên trên và dùng lạnh.",
    ],
    ingredients: [g("Nếp cẩm", 40), g("Sữa chua", 100), g("Đường", 10)],
  },
  {
    slug: "sinh-to-bo", name: "Sinh tố bơ", cuisine: "Việt Nam",
    description: "Sinh tố quả bơ béo mịn với sữa tươi và chút sữa đặc.",
    prepMinutes: 5, cookMinutes: 0, calories: 280, proteinG: 5, carbsG: 22, fatG: 19, fiberG: 7,
    dietTags: ["VEGETARIAN"], mealTypes: ["SNACK"], imageUrl: img.drinkDessert,
    instructions: [
      "Bổ đôi quả bơ, bỏ hạt và dùng thìa nạo lấy phần thịt.",
      "Cho thịt bơ, sữa tươi, sữa đặc và đá viên vào máy xay.",
      "Xay ở tốc độ cao 40–60 giây đến khi hỗn hợp mịn.",
      "Rót ra ly và dùng ngay để bơ không bị thâm.",
    ],
    ingredients: [item("Quả bơ", 0.5), ml("Sữa tươi", 100), ml("Sữa đặc", 15), g("Đá viên", 100)],
  },
  {
    slug: "khoai-lang-luoc", name: "Khoai lang luộc", cuisine: "Việt Nam",
    description: "Khoai lang luộc bùi ngọt, nhiều chất xơ, bữa phụ đơn giản; thuần chay.",
    prepMinutes: 5, cookMinutes: 25, calories: 240, proteinG: 2, carbsG: 56, fatG: 0, fiberG: 5,
    dietTags: ["BALANCED", "VEGETARIAN", "VEGAN"], mealTypes: ["SNACK"], imageUrl: img.grainBreakfast,
    instructions: [
      "Rửa sạch khoai lang, cắt bỏ hai đầu, giữ nguyên vỏ.",
      "Cho khoai vào nồi, đổ nước ngập khoai và thêm một nhúm muối.",
      "Đun sôi rồi hạ lửa vừa, luộc 20–25 phút đến khi xiên tăm thấy mềm.",
      "Vớt khoai ra để ráo, dùng khi còn ấm.",
    ],
    ingredients: [g("Khoai lang", 200), g("Muối", 1)],
  },
];
