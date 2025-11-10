import { Plus, X, Info } from "lucide-react";

/**
 * Custom Schedule Component
 */
const CustomSchedule = ({ customSchedule, onDayCheck, onTimeSlotChange, onAddTimeSlot, onRemoveTimeSlot }) => {
  return (
    <div className="auto-rule-popup-custom-schedule">
      {/* <div className="auto-rule-popup-custom-schedule-header">
        <div className="auto-rule-popup-custom-schedule-icon">
          <Info size={20} />
        </div>
        <span className="auto-rule-popup-custom-schedule-title">Tùy chỉnh</span>
      </div>
      <p className="auto-rule-popup-custom-schedule-description">
        Hãy điều chỉnh lịch chạy quy tắc để chạy vào những ngày và giờ cụ thể. Nếu thời gian bắt đầu và kết thúc giống nhau, quy tắc sẽ chạy mỗi ngày một lần trong vòng 30-60 phút sau thời gian đã đặt. Tất cả thời gian đều theo <strong>Giờ TP Hồ Chí Minh</strong>
      </p> */}

      {/* Days Rows */}
      {customSchedule.days.map((day, dayIndex) => (
        <div key={dayIndex} className="auto-rule-popup-custom-schedule-day-group">
          {day.timeSlots.map((slot, slotIndex) => (
            <div key={slotIndex} className="auto-rule-popup-custom-schedule-row">
              {slotIndex === 0 && (
                <>
                  <input
                    type="checkbox"
                    className="auto-rule-popup-custom-schedule-checkbox"
                    checked={day.checked}
                    onChange={(e) => onDayCheck(dayIndex, e.target.checked)}
                  />
                  <span className="auto-rule-popup-custom-schedule-day-name">{day.day}</span>
                </>
              )}
              {slotIndex > 0 && (
                <div className="auto-rule-popup-custom-schedule-day-spacer"></div>
              )}
              <div className="auto-rule-popup-custom-schedule-time-group">
                <input
                  type="time"
                  className="auto-rule-popup-time-input"
                  value={slot.startTime}
                  onChange={(e) =>
                    onTimeSlotChange(dayIndex, slotIndex, "startTime", e.target.value)
                  }
                  disabled={!day.checked}
                />
                <span className="auto-rule-popup-time-separator">đến</span>
                <input
                  type="time"
                  className="auto-rule-popup-time-input"
                  value={slot.endTime}
                  onChange={(e) =>
                    onTimeSlotChange(dayIndex, slotIndex, "endTime", e.target.value)
                  }
                  disabled={!day.checked}
                />
              </div>
              {slotIndex === 0 ? (
                <button
                  type="button"
                  className="auto-rule-popup-custom-schedule-btn-add"
                  onClick={() => onAddTimeSlot(dayIndex)}
                  title="Thêm time slot cho ngày này"
                  disabled={!day.checked}
                >
                  <Plus size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="auto-rule-popup-custom-schedule-btn-remove"
                  onClick={() => onRemoveTimeSlot(dayIndex, slotIndex)}
                  title="Xóa time slot này"
                  disabled={!day.checked}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default CustomSchedule;

