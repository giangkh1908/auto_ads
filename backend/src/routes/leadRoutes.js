import express from "express";
import { 
  createLead, 
  getLeads, 
  updateLeadStatus, 
  assignLead 
} from "../controllers/leadController.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Route công khai - không cần authenticate
router.post("/", createLead);

// Routes cần authenticate
router.use(authenticate);
router.get("/", getLeads);
router.put("/:id/status", updateLeadStatus);
router.put("/:id/assign", assignLead);

export default router;

