import { Apple, Beef, Box, CookingPot, Leaf, Milk, Wheat } from "lucide-react";

export default function CategoryIcon({ category }: { category: string }) {
  const value = category.toLowerCase();
  if (value.includes("rau")) return <Leaf />;
  if (value.includes("thịt") || value.includes("cá")) return <Beef />;
  if (value.includes("trái")) return <Apple />;
  if (value.includes("sữa") || value.includes("trứng")) return <Milk />;
  if (value.includes("ngũ") || value.includes("khô")) return <Wheat />;
  if (value.includes("gia vị")) return <CookingPot />;
  return <Box />;
}
