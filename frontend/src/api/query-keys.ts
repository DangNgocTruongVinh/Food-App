// Session changes clear QueryClient, so these existing keys cannot leak across users.
export const queryKeys = {
  profile: ["profile"],
  dashboard: ["dashboard"],
  pantry: ["pantry"],
  recipes: {
    all: ["recipes"] as const,
    list: (filters: { search?: string; cuisine?: string } = {}) => ["recipes", "list", filters] as const,
    detail: (id: string) => ["recipes", "detail", id] as const,
    stats: ["recipes", "stats"] as const,
    forYouAll: ["recipes", "for-you"] as const,
    forYou: (id: string) => ["recipes", "for-you", id] as const,
  },
  mealPlans: {
    all: ["meal-plans"] as const,
    list: () => ["meal-plans", "list"] as const,
    detail: (id: string) => ["meal-plans", "detail", id] as const,
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
  notifications: {
    all: ["notifications"] as const,
    lists: ["notifications", "list"] as const,
    list: (params: { filter: "all" | "unread"; limit: number }) => ["notifications", "list", params] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
} as const;
