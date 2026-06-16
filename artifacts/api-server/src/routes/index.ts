import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analiseRouter from "./analise";

const router: IRouter = Router();
router.use(healthRouter);
router.use(analiseRouter);

export default router;