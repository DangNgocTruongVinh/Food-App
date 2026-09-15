// Session changes clear QueryClient, so these existing keys cannot leak across users.
export const queryKeys = {
  profile: ["profile"],
  dashboard: ["dashboard"],
  pantry: ["pantry"],
  recipes: {
    all: ["recipes"] as const,
    list: (filters: { search?: string; cuisine?: string } = {}) => ["recipes", "list", filters] as const,
    detail: (id: string) => ["recipes", "detail", id] as const,
  },
  mealPlans: {
    all: ["meal-plans"] as const,
    list: () => ["meal-plans", "list"] as const,
    detail: (id: string) => ["meal-plans", "detail", id] as const,
  },
  ai: {
    all: ["ai"] as const,
    history: ["ai", "history"] as const,
  },
} as const;
