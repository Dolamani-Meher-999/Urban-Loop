import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getExploreData } from "../controllers/exploreController.js";

const router = express.Router();

router.get("/:city", protect, getExploreData);

export default router;