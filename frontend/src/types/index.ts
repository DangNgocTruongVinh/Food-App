export type FoodUnit = "G" | "KG" | "ML" | "L" | "ITEM" | "PACKAGE";
export type StorageLocation = "REFRIGERATOR" | "FREEZER" | "DRY_STORAGE";
export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
export type DietTag = "BALANCED" | "VEGETARIAN" | "VEGAN" | "LOW_CARB" | "HIGH_PROTEIN";
export type MealPlanStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

/** role: phiên lưu trước khi có phân quyền không có trường này → coi như USER. */
export interface User { id: string; name: string; email: string; role?: "USER" | "ADMIN" }
export interface AuthResponse { token: string; user: User }
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { name: string }

export interface CommunityAuthor { id: string; name: string }
export interface CommunityComment {
  id: string; content: string; createdAt: string; updatedAt: string; author: CommunityAuthor;
}
/** Tóm tắt công thức gắn trong bài viết (feed không trả nguyên liệu/các bước). */
export interface CommunityRecipeSummary {
  id: string; name: string; imageUrl?: string | null; calories: number; prepMinutes: number; cookMinutes: number; hidden?: boolean;
}
export interface CommunityPost {
  id: string; content: string; createdAt: string; updatedAt: string; author: CommunityAuthor;
  recipe: CommunityRecipeSummary | null;
  /** Ảnh trong bài (tối đa 4), URL Cloudinary gốc; hiển thị qua optimizedImageUrl. */
  images: Array<{ url: string; position: number }>;
  likedByMe: boolean; likeCount: number; commentCount: number; comments: CommunityComment[];
}

export type NotificationType =
  | "PANTRY_EXPIRING"
  | "PANTRY_EXPIRED"
  | "PANTRY_LOW_STOCK"
  | "MEAL_REMINDER"
  | "MEAL_PLAN_CREATED"
  | "MEAL_PREP_REMINDER"
  | "COMMUNITY_LIKE"
  | "COMMUNITY_COMMENT"
  | "COMMUNITY_REPLY"
  | "COMMUNITY_FOLLOW"
  | "AI_RECIPE_SUGGESTION"
  | "AI_EXPIRY_SUGGESTION"
  | "AI_NUTRITION_SUGGESTION";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedId: string | null;
  actionUrl: string | null;
  createdAt: string;
}

export interface NutritionProfile {
  age?: number; gender?: "MALE" | "FEMALE" | "OTHER"; heightCm?: number; weightKg?: number;
  targetWeightKg?: number; activityLevel: string; goal: string; dietType: string;
  allergies: string[]; dislikedFoods: string[]; preferredCuisines: string[]; mealsPerDay: number;
  dailyCalorieTarget?: number; proteinTargetG?: number; carbTargetG?: number; fatTargetG?: number;
}

export interface ProfileResponse extends User { profile: NutritionProfile | null }

export type ProfileUpdateInput = Partial<Pick<NutritionProfile,
  "activityLevel" | "goal" | "dietType" | "allergies" | "dislikedFoods" | "preferredCuisines" | "mealsPerDay"
>> & {
  name?: string;
  age?: number | null;
  gender?: NutritionProfile["gender"] | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
};

export interface PantryItem {
  id: string; name: string; category: string; quantity: number; unit: FoodUnit;
  storageLocation: StorageLocation; expiryDate: string | null; minimumStock: number; note?: string | null;
  /** Hạn do hệ thống gợi ý (đã mua, quét ảnh), chưa được người dùng xác nhận (GĐ3b). */
  expiryEstimated?: boolean;
}

export type PantryTransactionSource = "MANUAL_ADD" | "MANUAL_EDIT" | "MANUAL_DELETE" | "CONSUMPTION" | "PURCHASE" | "RECEIPT_SCAN";
/** Một dòng lịch sử kho (GET /api/pantry/transactions): `delta` theo `unit`, `quantityAfter` là số còn lại sau thay đổi. */
export interface PantryTransaction {
  id: string; pantryItemId: string | null; itemName: string; unit: FoodUnit; delta: number; quantityAfter: number;
  source: PantryTransactionSource; note: string | null; reversalOfId: string | null; reversedAt: string | null; createdAt: string;
  mealPlanItem: { id: string; mealType: MealType; recipe: { name: string }; day: { date: string; mealPlanId: string } } | null;
  shoppingItem: { id: string; name: string; mealPlanId: string } | null;
}
export interface PantryTransactionPage { items: PantryTransaction[]; total: number; page: number; pageSize: number }

export interface PantryInput {
  name: string; category: string; quantity: number; unit: FoodUnit;
  storageLocation: StorageLocation; expiryDate?: string | null; minimumStock: number; note?: string | null;
}

export type PantryUpdateInput = Partial<PantryInput>;

export interface Ingredient { id: string; name: string; quantity: number; unit: FoodUnit; optional: boolean }
export interface Recipe {
  id: string; name: string; description: string; instructions: string[]; prepMinutes: number; cookMinutes: number;
  servings: number; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
  cuisine: string; dietTags: string[]; mealTypes?: MealType[]; imageUrl?: string | null; ingredients: Ingredient[];
  /** Món đã ngừng sử dụng (Admin ẩn): vẫn xem được chi tiết, không chia sẻ/không chọn mới. */
  hidden?: boolean;
}

/** GET /api/recipes/:id/for-you: mức phù hợp của công thức với hồ sơ và kho của người dùng đang đăng nhập. */
export interface RecipeForYou {
  recipeId: string;
  pantry: {
    totalIngredients: number; inPantryCount: number; inPantry: string[];
    missing: Array<{ name: string; optional: boolean }>; expiring: string[]; expired: string[];
    unitMismatches: Array<{ name: string; recipeUnit: FoodUnit; pantryUnits: FoodUnit[] }>;
  };
  calories: { recipeCalories: number; dailyTarget: number; percentOfDailyTarget: number };
  warnings: { allergens: string[]; dislikedFoods: string[]; dietConflict: string | null };
}

/** GET /api/recipes/featured (công khai): món tiêu biểu cho Landing, chỉ trường tóm tắt, món có ảnh thật đứng trước. */
export interface FeaturedRecipe {
  id: string; slug: string; name: string; imageUrl: string | null; calories: number; prepMinutes: number; cookMinutes: number;
  dietTags: string[]; mealTypes: MealType[];
}

/** GET /api/recipes/stats (công khai): số công thức theo nhóm cho Landing. */
export interface RecipeStats { total: number; breakfast: number; vegetarian: number; vegan: number; lowCarb: number; highProtein: number }

/** "Đã ăn" → trừ kho (GĐ3b): trạng thái từng nguyên liệu trong hộp xem trước. */
export type ConsumptionStatus = "ENOUGH" | "SHORT" | "NOT_IN_PANTRY" | "UNIT_MISMATCH" | "EXPIRED_ONLY" | "OPTIONAL";
export interface ConsumptionDeduction {
  pantryItemId: string; name: string; quantity: number; unit: FoodUnit; expiryDate: string | null; quantityAfter: number;
}
export interface ConsumptionLine {
  ingredientId: string; name: string; optional: boolean; required: { quantity: number; unit: FoodUnit }; status: ConsumptionStatus;
  deductions: ConsumptionDeduction[]; shortfall: number; defaultQuantity: number; otherUnits: FoodUnit[];
}
/** GET /api/meal-plans/items/:id/consumption-preview */
export interface ConsumptionPreview {
  mealPlanItemId: string; completed: boolean; alreadyDeducted: boolean; servings: number;
  recipe: { id: string; name: string; servings: number }; lines: ConsumptionLine[];
}
export type ConsumptionSkipReason = "DELETED" | "UNIT_MISMATCH" | "CHANGED";
/** PATCH /api/meal-plans/items/:id: bữa đã cập nhật + tóm tắt trừ kho / hoàn lại. */
export interface MealCompletionResult {
  id: string; completed: boolean; alreadyCompleted: boolean;
  consumption: {
    lines: Array<ConsumptionLine & { skipped: Array<{ pantryItemId: string; reason: ConsumptionSkipReason }> }>;
    skippedIngredients: Array<{ ingredientId: string; name: string }>;
  } | null;
  restoration: {
    restored: Array<{ pantryItemId: string; name: string; quantity: number; unit: FoodUnit; quantityAfter: number }>;
    skipped: Array<{ itemName: string; quantity: number; unit: FoodUnit; reason: ConsumptionSkipReason }>;
  } | null;
}

export interface MealPlanItem { id: string; mealType: MealType; servings: number; calories: number; completed: boolean; recipe: Recipe }
export interface MealPlanDay { id: string; date: string; items: MealPlanItem[] }
export interface ShoppingItem { id: string; name: string; quantity: number; unit: FoodUnit; purchased: boolean; category?: string | null }
/** PATCH /api/meal-plans/shopping/:id: dòng đi chợ đã cập nhật + tóm tắt thêm vào kho / hoàn lại (GĐ3b lượt 6). */
export interface ShoppingPurchaseResult extends ShoppingItem {
  alreadyPurchased: boolean;
  pantry: {
    action: "MERGED" | "REUSED" | "CREATED"; pantryItemId: string; name: string; quantity: number; unit: FoodUnit; quantityAfter: number;
    expiryDate: string | null; expiryEstimated: boolean;
  } | null;
  restoration: {
    restored: Array<{ pantryItemId: string; name: string; quantity: number; unit: FoodUnit; quantityAfter: number; removed: boolean }>;
    skipped: Array<{ itemName: string; quantity: number; unit: FoodUnit; reason: ConsumptionSkipReason | "INSUFFICIENT" }>;
  } | null;
}
export interface MealPlan {
  id: string; name: string; startDate: string; endDate: string; status: MealPlanStatus;
  calorieTarget: number; aiGenerated: boolean; summary?: string; days: MealPlanDay[]; shoppingItems: ShoppingItem[];
  createdAt?: string;
}

// Số liệu kho chỉ có ở món gợi ý thật từ API; món mẫu dự phòng không có.
export interface DashboardRecommendedRecipe {
  id: string; name: string; calories: number; prepMinutes: number; cookMinutes: number; dietTags: string[];
  imageUrl?: string | null; totalIngredients?: number; pantryIngredientCount?: number; expiringIngredientCount?: number;
}

export interface DashboardData {
  nutritionTargets: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  pantryCount: number; expiringItems: PantryItem[]; expiredCount: number;
  activePlan: { id: string; name: string; completionRate: number } | null;
  recommendedRecipes: DashboardRecommendedRecipe[];
  todayMeals: Array<{
    id: string; mealType: MealType; calories: number; completed: boolean;
    recipe: { id: string; name: string; prepMinutes: number; cookMinutes: number };
  }>;
}

export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; createdAt: string }
