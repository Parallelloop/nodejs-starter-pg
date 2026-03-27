import express from "express";
import { ExploreQuery } from "../controllers/explore";

const router = express.Router();

router.post("/", ExploreQuery);

export default router;
