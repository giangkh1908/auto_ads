import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useOnClickOutside } from "../../../utils/useOnClickOutside"; // ✅ Thêm import
import "./DateRangePicker.css";

function DateRangePicker({ value, onChange, placeholder = "dd/mm/yyyy - dd/mm/yyyy" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const pickerRef = useRef(null);

  // Parse value từ string "dd/mm/yyyy - dd/mm/yyyy"
  useEffect(() => {
    if (value) {
      const parts = value.split(" - ");
      if (parts.length === 2) {
        const start = parseDate(parts[0]);
        const end = parseDate(parts[1]);
        if (start && end) {
          setStartDate(start);
          setEndDate(end);
        }
      }
    }
  }, [value]);

  useOnClickOutside(pickerRef, () => setIsOpen(false));

  const parseDate = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.trim().split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  };

  const formatDate = (date) => {
    if (!date) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getDisplayValue = () => {
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    if (startDate) {
      return formatDate(startDate);
    }
    return "";
  };

  const handleDateClick = (date) => {
    if (!startDate || (startDate && endDate)) {
      // Bắt đầu chọn range mới hoặc reset
      setStartDate(date);
      setEndDate(null);
      setHoverDate(null);
    } else if (startDate && !endDate) {
      // Hoàn thành chọn range
      if (date < startDate) {
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
      setHoverDate(null);
      
      // Gọi onChange với giá trị formatted
      const finalStart = date < startDate ? date : startDate;
      const finalEnd = date < startDate ? startDate : date;
      onChange(`${formatDate(finalStart)} - ${formatDate(finalEnd)}`);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days = [];
    // Thêm các ngày trống ở đầu tháng
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Thêm các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const isDateInRange = (date) => {
    if (!startDate || !date) return false;
    const effectiveEnd = endDate || hoverDate;
    if (effectiveEnd) {
      if (date < startDate) return false;
      if (effectiveEnd < startDate) return false; // Không hiển thị range nếu end < start
      return date >= startDate && date <= effectiveEnd;
    }
    return false;
  };

  const isHoverEndDate = (date) => {
    if (!hoverDate || endDate || !date) return false;
    return date.getTime() === hoverDate.getTime();
  };

  const isStartDate = (date) => {
    if (!startDate || !date) return false;
    return date.getTime() === startDate.getTime();
  };

  const isEndDate = (date) => {
    if (!endDate || !date) return false;
    return date.getTime() === endDate.getTime();
  };

  const getMonthName = (date) => {
    const months = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ];
    return months[date.getMonth()];
  };

  const getYear = (date) => {
    return date.getFullYear();
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getNextMonth = () => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  };

  const weekDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  return (
    <div className="analytics-date-range-picker-wrapper" ref={pickerRef}>
      <div className="analytics-date-range-input-container">
        <input
          type="text"
          className="analytics-date-range-input"
          placeholder={placeholder}
          value={getDisplayValue()}
          readOnly
          onClick={() => setIsOpen(!isOpen)}
        />
        <Calendar 
          className="analytics-date-range-icon" 
          size={16}
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>
      {isOpen && (
        <div className="analytics-date-range-picker">
          <div className="analytics-date-range-picker-content">
            {/* Calendar 1 - Tháng hiện tại */}
            <div className="analytics-calendar-month">
              <div className="analytics-calendar-header">
                <button
                  className="analytics-calendar-nav-button"
                  onClick={prevMonth}
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="analytics-calendar-month-year">
                  {getMonthName(currentMonth)} {getYear(currentMonth)}
                </div>
                <button
                  className="analytics-calendar-nav-button"
                  onClick={nextMonth}
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="analytics-calendar-weekdays">
                {weekDays.map((day) => (
                  <div key={day} className="analytics-calendar-weekday">
                    {day}
                  </div>
                ))}
              </div>
              <div className="analytics-calendar-days">
                {getDaysInMonth(currentMonth).map((date, index) => {
                  if (!date) {
                    return (
                      <div key={`empty-${index}`} className="analytics-calendar-day empty" />
                    );
                  }
                  const isSelected = isStartDate(date) || isEndDate(date);
                  const inRange = isDateInRange(date);
                  const isStart = isStartDate(date);
                  const isEnd = isEndDate(date) || isHoverEndDate(date);

                  return (
                    <button
                      key={date.getTime()}
                      type="button"
                      className={`analytics-calendar-day ${
                        isSelected ? "selected" : ""
                      } ${inRange ? "in-range" : ""} ${isStart ? "start-date" : ""} ${
                        isEnd ? "end-date" : ""
                      }`}
                      onClick={() => handleDateClick(date)}
                      onMouseEnter={() => {
                        if (startDate && !endDate) {
                          setHoverDate(date);
                        }
                      }}
                      onMouseLeave={() => {
                        if (startDate && !endDate) {
                          setHoverDate(null);
                        }
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar 2 - Tháng tiếp theo */}
            <div className="analytics-calendar-month">
              <div className="analytics-calendar-header">
                <button
                  className="analytics-calendar-nav-button"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                    )
                  }
                  type="button"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="analytics-calendar-month-year">
                  {getMonthName(getNextMonth())} {getYear(getNextMonth())}
                </div>
                <button
                  className="analytics-calendar-nav-button"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 1)
                    )
                  }
                  type="button"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="analytics-calendar-weekdays">
                {weekDays.map((day) => (
                  <div key={day} className="analytics-calendar-weekday">
                    {day}
                  </div>
                ))}
              </div>
              <div className="analytics-calendar-days">
                {getDaysInMonth(getNextMonth()).map((date, index) => {
                  if (!date) {
                    return (
                      <div key={`empty-${index}`} className="analytics-calendar-day empty" />
                    );
                  }
                  const isSelected = isStartDate(date) || isEndDate(date);
                  const inRange = isDateInRange(date);
                  const isStart = isStartDate(date);
                  const isEnd = isEndDate(date) || isHoverEndDate(date);

                  return (
                    <button
                      key={date.getTime()}
                      type="button"
                      className={`analytics-calendar-day ${
                        isSelected ? "selected" : ""
                      } ${inRange ? "in-range" : ""} ${isStart ? "start-date" : ""} ${
                        isEnd ? "end-date" : ""
                      }`}
                      onClick={() => handleDateClick(date)}
                      onMouseEnter={() => {
                        if (startDate && !endDate) {
                          setHoverDate(date);
                        }
                      }}
                      onMouseLeave={() => {
                        if (startDate && !endDate) {
                          setHoverDate(null);
                        }
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;

