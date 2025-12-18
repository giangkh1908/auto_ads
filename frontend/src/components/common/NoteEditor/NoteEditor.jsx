import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { saveNote } from "../../../utils/business-logic/noteUtils";
import { useToast } from "../../../hooks/common/useToast";
import "./NoteEditor.css";

/**
 * NoteEditor Component
 * Inline editor cho note với khả năng edit và save
 */
export default function NoteEditor({
  targetType,
  targetId,
  initialNote = "",
  noteId = null,
  placeholder = "Click để thêm ghi chú...",
  onNoteSaved = null,
  maxLength = 1000,
  disabled = false,
  disabledMessage = "Vui lòng nhận xử lý để thêm ghi chú",
}) {
  const { t } = useTranslation("common");
  const [note, setNote] = useState(initialNote);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);
  const saveButtonRef = useRef(null);
  const isSavingRef = useRef(false); // Prevent double save
  const toast = useToast();

  // Sync với initialNote khi prop thay đổi
  useEffect(() => {
    setNote(initialNote || "");
  }, [initialNote]);

  // Auto focus khi bắt đầu edit
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  useEffect(() => {
    if (disabled && isEditing) {
      setIsEditing(false);
    }
  }, [disabled, isEditing]);

  const handleClick = () => {
    if (disabled) return;
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    // Không auto-save khi blur để tránh tạo duplicate note
    // User phải click button "Lưu" hoặc dùng Ctrl+Enter để save
    // Điều này đảm bảo chỉ có 1 lần save được thực hiện
  };

  const handleSave = async () => {
    // Prevent double save
    if (isSavingRef.current || isSaving) {
      return;
    }

    if (!targetType || !targetId) {
      toast.error(t("noteEditor.missingInfo"));
      return;
    }

    const noteText = note.trim();

    // Nếu note rỗng và không có noteId, không cần save
    if (!noteText && !noteId) {
      setIsEditing(false);
      return;
    }

    // Set flag để prevent double save
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const savedNote = await saveNote(
        targetType,
        targetId,
        noteText,
        noteId
      );

      if (savedNote) {
        setIsEditing(false);
        toast.success(t("noteEditor.saveSuccess"));

        // Callback để parent component có thể update state
        if (onNoteSaved) {
          onNoteSaved({
            note: noteText,
            noteId: savedNote._id || savedNote.id || noteId,
          });
        }
      } else {
        throw new Error(t("noteEditor.saveError"));
      }
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error(
        error.response?.data?.message ||
        error.message ||
        t("noteEditor.saveErrorGeneric")
      );
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleKeyDown = (e) => {
    // Save on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    // Cancel on Escape
    if (e.key === "Escape") {
      setNote(initialNote || "");
      setIsEditing(false);
    }
  };

  // Nếu đang edit, hiển thị textarea
  if (isEditing) {
    return (
      <div className="note-editor-wrapper">
        <textarea
          ref={textareaRef}
          className="note-editor-textarea"
          value={note}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= maxLength) {
              setNote(value);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          disabled={isSaving}
        />
        <div className="note-editor-footer">
          <span className="note-editor-counter">
            {note.length}/{maxLength}
          </span>
          <div className="note-editor-actions">
            <button
              ref={saveButtonRef}
              className="note-editor-btn note-editor-btn-save"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }}
              disabled={isSaving}
              type="button"
            >
              {isSaving ? t("noteEditor.saving") : t("noteEditor.save")}
            </button>
            <button
              className="note-editor-btn note-editor-btn-cancel"
              onClick={() => {
                setNote(initialNote || "");
                setIsEditing(false);
              }}
              disabled={isSaving}
            >
              {t("noteEditor.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Nếu không edit, hiển thị text có thể click
  return (
    <div
      className={`note-editor-display ${!note ? "note-editor-empty" : ""} ${disabled ? "note-editor-disabled" : ""
        }`}
      onClick={handleClick}
      title={disabled ? disabledMessage : t("noteEditor.clickToEdit")}
    >
      {note || placeholder}
    </div>
  );
}

