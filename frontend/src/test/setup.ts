import { setAllergyCatalog } from "../features/profile/allergy-groups";
import { SEED_CATALOG } from "./seed-catalog";

// Như khi app đã tải GET /api/catalog: logic nhóm dị ứng dùng chung đọc danh mục seed cố định.
setAllergyCatalog(SEED_CATALOG.allergenGroups);
