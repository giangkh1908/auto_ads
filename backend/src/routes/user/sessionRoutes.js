import express from "express";
import { getSessions, revokeSession, revokeAllSessions } from "../../controllers/user/sessionControllers.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authenticate, getSessions);
router.delete("/:jti", authenticate, revokeSession);
router.delete("/all", authenticate, revokeAllSessions);

export default router;
