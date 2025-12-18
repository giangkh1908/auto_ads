import express from "express";
import {
  getNotes,
  getLatestNote,
  getLatestNotesBatch,
  createNote,
  updateNote,
  deleteNote,
} from "../../controllers/admin/noteController.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();
router.use(authenticate);

router.get("/", getNotes); // ?target_type=User&target_id=123
router.get("/latest", getLatestNote); // ?target_type=User&target_id=123
router.post("/batch", getLatestNotesBatch); // POST body: { items: [...] }
router.post("/", createNote);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);

export default router;

