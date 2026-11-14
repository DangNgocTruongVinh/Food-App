import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { getCatalogController } from "./catalog.controller.js";

/** Danh mục dữ liệu tham chiếu (không có gì riêng của người dùng) nên không cần đăng nhập; ô Hồ sơ, Kho, đi chợ, Admin dùng chung. */
const router = Router();

router.get("/", asyncHandler(getCatalogController));

export default router;
