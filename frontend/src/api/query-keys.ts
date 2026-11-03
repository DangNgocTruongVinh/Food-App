// Session changes clear QueryClient, so these existing keys cannot leak across users.
export const queryKeys = {
  profile: ["profile"],
  dashboard: ["dashboard"],
  recommendations: {
    all: ["recommendations"] as const,
    list: (params: { context: string; recipeId?: string; pantryItemId?: string; limit: number }) => ["recommendations", params] as const,
  },
  pantry: ["pantry"],
  // Cùng tiền tố "pantry": mọi chỗ làm mới kho cũng làm mới lịch sử kho.
  pantryTransactions: (filters: { source?: string; pantryItemId?: string; page: number; pageSize: number }) => ["pantry", "transactions", filters] as const,
  recipes: {
    all: ["recipes"] as const,
    list: (filters: { search?: string; cuisine?: string } = {}) => ["recipes", "list", filters] as const,
    detail: (id: string) => ["recipes", "detail", id] as const,
    stats: ["recipes", "stats"] as const,
    featured: (limit: number) => ["recipes", "featured", limit] as const,
    forYouAll: ["recipes", "for-you"] as const,
    forYou: (id: string) => ["recipes", "for-you", id] as const,
  },
  mealPlans: {
    all: ["meal-plans"] as const,
    list: () => ["meal-plans", "list"] as const,
    detail: (id: string) => ["meal-plans", "detail", id] as const,
    consumptionPreview: (itemId: string) => ["meal-plans", "consumption-preview", itemId] as const,
  },
  ai: {
    all: ["ai"] as const,
    history: ["ai", "history"] as const,
    status: ["ai", "status"] as const,
  },
  community: {
    all: ["community"] as const,
    feed: () => ["community", "feed"] as const,
  },
  admin: {
    all: ["admin"] as const,
    stats: ["admin", "stats"] as const,
    recipes: (query: { search?: string; status: string; page: number; pageSize: number }) => ["admin", "recipes", query] as const,
    recipe: (id: string) => ["admin", "recipe", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    lists: ["notifications", "list"] as const,
    list: (params: { filter: "all" | "unread"; limit: number }) => ["notifications", "list", params] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
} as const;
