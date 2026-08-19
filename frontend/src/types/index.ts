export type FoodUnit = "G" | "KG" | "ML" | "L" | "ITEM" | "PACKAGE";
export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export interface User { id: string; name: string; email: string }
export interface AuthResponse { token: string; user: User }

export interface NutritionProfile {
  age?: number; gender?: "MALE" | "FEMALE" | "OTHER"; heightCm?: number; weightKg?: number;
  targetWeightKg?: number; activityLevel: string; goal: string; dietType: string;
  allergies: string[]; dislikedFoods: string[]; preferredCuisines: string[]; mealsPerDay: number;
  dailyCalorieTarget?: number; proteinTargetG?: number; carbTargetG?: number; fatTargetG?: number;
}

export interface ProfileResponse extends User { profile: NutritionProfile | null }

export interface PantryItem {
  id: string; name: string; category: string; quantity: number; unit: FoodUnit;
  expiryDate: string | null; minimumStock: number; note?: string;
}

export interface Ingredient { id: string; name: string; quantity: number; unit: FoodUnit; optional: boolean }
export interface Recipe {
  id: string; name: string; description: string; instructions: string[]; prepMinutes: number; cookMinutes: number;
  servings: number; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
  cuisine: string; dietTags: string[]; ingredients: Ingredient[];
}

export interface MealPlanItem { id: string; mealType: MealType; servings: number; calories: number; completed: boolean; recipe: Recipe }
export interface MealPlanDay { id: string; date: string; items: MealPlanItem[] }
export interface ShoppingItem { id: string; name: string; quantity: number; unit: FoodUnit; purchased: boolean }
export interface MealPlan {
  id: string; name: string; startDate: string; endDate: string; status: "DRAFT" | "ACTIVE" | "COMPLETED";
  calorieTarget: number; aiGenerated: boolean; summary?: string; days: MealPlanDay[]; shoppingItems: ShoppingItem[];
}

export interface DashboardData {
  nutritionTargets: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  pantryCount: number; expiringItems: PantryItem[]; expiredCount: number;
  activePlan: { id: string; name: string; completionRate: number } | null;
  recommendedRecipes: Array<{ id: string; name: string; calories: number; prepMinutes: number; cookMinutes: number; dietTags: string[] }>;
  todayMeals: Array<{
    id: string; mealType: MealType; calories: number; completed: boolean;
    recipe: { id: string; name: string; prepMinutes: number; cookMinutes: number };
  }>;
}

export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; createdAt: string }
