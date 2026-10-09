import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import storeRouter from "./store";
import printRouter from "./print";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storeRouter);
router.use(adminRouter);
router.use(printRouter);
router.use(webhooksRouter);

export default router;
