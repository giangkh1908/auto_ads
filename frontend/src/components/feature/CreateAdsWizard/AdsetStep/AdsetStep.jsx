import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getNames } from "country-list";
import {
  MapPin,
  Users,
  Calendar,
  DollarSign,
  Target,
  Circle,
  Search,
  Globe,
  Smartphone,
  MessageSquare,
  Phone,
  Facebook,
} from "lucide-react";
import { useOnClickOutside } from "../../../../utils/useOnClickOutside";
import { useToast } from "../../../../hooks/useToast";
import {
  getOneDayAfter,
  toInputDateTimeLocal,
  isEndAtLeastOneDayAfterStart,
  ensureEndAfterStartPlusOneDay,
} from "../../../../utils/validation";
// import { validateNonEmpty } from "../../../../utils/validation";
import { getAdsetDefaultsByObjective } from "../../../../constants/wizardConstants";
import {
  getOptimizationGoals,
  getCompatibleBillingEvents,
} from "../../../../constants/wizardConstants";
import no_avatar from "../../../../assets/no-avatar.jpg";
import "./AdsetStep.css";

import AwarenessSchema from "./objectives/Awareness";
import TrafficSchema from "./objectives/Traffic";
import EngagementSchema from "./objectives/Engagement";
import LeadsSchema from "./objectives/Leads";
import SalesSchema from "./objectives/Sales";
import AppPromotionSchema from "./objectives/AppPromotion";

const SCHEMA_MAP = {
  AWARENESS: AwarenessSchema,
  TRAFFIC: TrafficSchema,
  ENGAGEMENT: EngagementSchema,
  LEADS: LeadsSchema,
  SALES: SalesSchema,
  APP_PROMOTION: AppPromotionSchema,
};

const ICON_MAP = {
  Circle,
  Target,
  DollarSign,
  Calendar,
  Users,
  MapPin,
  Search,
  Globe,
  Smartphone,
  MessageSquare,
  Phone,
};

function getValue(obj, path) {
  if (!path || typeof path !== "string") return undefined;
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

function setValue(obj, path, val) {
  if (!path || typeof path !== "string") return obj;
  const keys = path.split(".");
  const copy = { ...obj };
  let cur = copy;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      cur[k] = val;
    } else {
      cur[k] = { ...(cur[k] || {}) };
      cur = cur[k];
    }
  });
  return copy;
}

const toInputDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${HH}:${mm}`;
};

const formatDisplay = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const MM = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${dd}/${MM}/${yyyy} ${HH}:${mm}`;
};

function FieldRenderer({ field, adset, setAdset, objective, mode }) {
  const toast = useToast();
  const value = getValue(adset, field.name || field.nameMin);
  const countries = getNames() || [];

  const [locationInput, setLocationInput] = useState("");
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationRef = useRef(null);
  useOnClickOutside(locationRef, () => setShowLocationSuggestions(false));

  const [interestInput, setInterestInput] = useState("");
  const [showInterestSuggestions, setShowInterestSuggestions] = useState(false);
  const interestRef = useRef(null);
  useOnClickOutside(interestRef, () => setShowInterestSuggestions(false));

  const handleChange = useCallback(
    (newValue) => {
      setAdset((prev) => setValue(prev, field.name, newValue));
    },
    [field.name, setAdset]
  );

  if (field.visibleIf && !field.visibleIf(adset)) {
    return null;
  }

  const isDisabled =
    typeof field.disabled === "function"
      ? field.disabled(adset, mode)
      : field.disabled;
  const hint =
    typeof field.hint === "function" ? field.hint(adset) : field.hint;

  switch (field.type) {
    case "input":
      return (
        <div className="field-group" key={field.name}>
          {field.label && <label className="field-label">{field.label}</label>}
          <input
            type="text"
            className={field.label ? "form-input" : "adset-name-input"}
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            onBlur={() => {
              if (field.validate) {
                const result = field.validate(value, adset);
                if (result !== true) toast.warning(result);
              }
            }}
          />
        </div>
      );

    case "select": {
      const options =
        typeof field.options === "function"
          ? field.options(objective, adset)
          : field.options || [];
      const selectedOption = options.find((opt) => opt.value === value);
      const showDescription = selectedOption?.description;

      return (
        <div className="field-group" key={field.name}>
          {field.label && <label className="field-label">{field.label}</label>}
          <select
            className={
              field.name === "budgetType"
                ? "budget-type"
                : field.label === "Loại tương tác"
                ? "performance-select"
                : "conversion-event-select"
            }
            value={value || field.default || ""}
            onChange={(e) => {
              const selectedValue = e.target.value;
              handleChange(selectedValue);

              // For optimization_goal: also set destination_type if exists
              if (field.name === "optimization_goal") {
                const selectedOpt = options.find(
                  (opt) => opt.value === selectedValue
                );
                if (selectedOpt?.destination_type) {
                  setAdset((prev) => ({
                    ...prev,
                    destination_type: selectedOpt.destination_type,
                  }));
                }
              }
            }}
            disabled={isDisabled}
          >
            {options.map((opt, index) => (
              <option
                key={`${field.name}-${opt.value}-${index}`}
                value={opt.value}
              >
                {opt.label}
              </option>
            ))}
          </select>
          {showDescription && (
            <div
              style={{
                marginTop: "8px",
                padding: "10px 12px",
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#0369a1",
                lineHeight: "1.5",
              }}
            >
              💡 {showDescription}
            </div>
          )}
          {hint && (
            <small
              className="field-hint"
              style={{ color: "#3275db", fontSize: "12px" }}
            >
              {hint}
            </small>
          )}
        </div>
      );
    }
    case "radio-group": {
      const radioOptions =
        typeof field.options === "function"
          ? field.options(objective, adset)
          : field.options || [];
      return (
        <div className="field-group" key={field.name}>
          {field.label && <label className="field-label">{field.label}</label>}
          <div className="traffic-destination-options">
            {radioOptions.map((opt) => {
              const IconComp = opt.icon ? ICON_MAP[opt.icon] : null;
              return (
                <label
                  key={opt.value}
                  className={`traffic-option ${
                    value === opt.value ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={value === opt.value}
                    onChange={(e) => handleChange(e.target.value)}
                  />
                  <div className="traffic-option-content">
                    {IconComp && <IconComp size={20} />}
                    <span>{opt.label}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    case "money": {
      return (
        <div className="field-group" key={field.name}>
          {field.label && <label className="field-label">{field.label}</label>}
          <div className="budget-input-group">
            <input
              type="text"
              className="budget-input-text"
              value={value ? Number(value).toLocaleString("vi-VN") : 0}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                handleChange(raw);
              }}
              onBlur={(e) => {
                const num = parseInt(e.target.value.replace(/[^\d]/g, ""));
                handleChange(num);
              }}
            />
            <div className="money-currency">{field.currency || "VND"}</div>
          </div>
        </div>
      );
    }
    case "number": {
      return (
        <div className="field-group" key={field.name}>
          {field.label && <label className="field-label">{field.label}</label>}
          <div className="bid-amount-container">
            <input
              type="number"
              className="bid-strategy-input"
              value={value || ""}
              onChange={(e) => handleChange(parseInt(e.target.value) || 0)}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder}
            />
            {field.suffix && (
              <span className="currency-suffix">{field.suffix}</span>
            )}
          </div>
        </div>
      );
    }
    case "datetime": {
      const lockMsg =
        typeof field.lockMessage === "string" ? field.lockMessage : null;

      const isStartField = String(field.name || "").endsWith("start_time");
      const isEndField = String(field.name || "").endsWith("end_time");
      const startIso = adset.start_time || null;
      const endIso = adset.end_time || null;

      const handleDateChange = (newIsoString) => {
        if (isEndField) {
          if (!isEndAtLeastOneDayAfterStart(startIso, newIsoString)) {
            toast.warning("Thời gian kết thúc phải lớn hơn thời gian bắt đầu ít nhất 1 ngày");
            return;
          }
          handleChange(newIsoString);
          return;
        }

        if (isStartField) {
          // set start_time and coerce end_time if needed
          handleChange(newIsoString);
          const coercedEnd = ensureEndAfterStartPlusOneDay(newIsoString, endIso);
          if (coercedEnd !== endIso) {
            setAdset((prev) => ({ ...prev, end_time: coercedEnd }));
            toast.info("Đã tự động cập nhật thời gian kết thúc (+1 ngày)");
          }
          return;
        }

        handleChange(newIsoString);
      };

      // Min for end_time input (start_time + 1 day)
      const minForEnd = isEndField && startIso ? toInputDateTimeLocal(getOneDayAfter(startIso)) : undefined;

      return (
        <div className="datetime-overlay-wrapper" key={field.name}>
          <input
            type="datetime-local"
            className="datetime-input-ads datetime-input-ads--masked"
            value={toInputDateTime(value)}
            onChange={(e) => handleDateChange(e.target.value)}
            min={minForEnd}
            disabled={isDisabled}
            title={isDisabled && lockMsg ? lockMsg : ""}
          />
          <span className="datetime-overlay">
            {formatDisplay(value) ||
              new Date().toISOString().split("T")[0] + " 00:00"}
          </span>
        </div>
      );
    }
    case "age-range": {
      const minVal = getValue(adset, field.nameMin) ?? field.defaultMin;
      const maxVal = getValue(adset, field.nameMax) ?? field.defaultMax;
      return (
        <div className="field-group" key={`${field.nameMin}-${field.nameMax}`}>
          {field.label && <label className="field-label">{field.label}</label>}
          <div className="age-inputs">
            <input
              type="number"
              className="age-input-adset"
              placeholder={String(field.defaultMin)}
              min={field.min}
              max={field.max}
              value={minVal}
              onChange={(e) => {
                const val =
                  e.target.value === "" ? "" : parseInt(e.target.value);
                setAdset((prev) => setValue(prev, field.nameMin, val));
              }}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setAdset((prev) =>
                    setValue(prev, field.nameMin, field.defaultMin)
                  );
                }
              }}
            />
            <span>--</span>
            <input
              type="number"
              className="age-input-adset"
              placeholder={String(field.defaultMax) + "+"}
              min={field.min}
              max={field.max}
              value={maxVal}
              onChange={(e) => {
                const val =
                  e.target.value === "" ? "" : parseInt(e.target.value);
                setAdset((prev) => setValue(prev, field.nameMax, val));
              }}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setAdset((prev) =>
                    setValue(prev, field.nameMax, field.defaultMax)
                  );
                }
              }}
            />
          </div>
        </div>
      );
    }
    case "tags-country": {
      const selectedTags = value || field.default || [];
      const filteredCountries = countries
        .filter((c) =>
          c.toLowerCase().includes(locationInput.trim().toLowerCase())
        )
        .slice(0, 8);
      return (
        <div key={field.name}>
          <div className="location-input-wrapper" ref={locationRef}>
            <input
              type="text"
              className="location-input"
              placeholder={field.placeholder}
              value={locationInput}
              onChange={(e) => {
                setLocationInput(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const trimmed = locationInput.replace(/,$/, "").trim();
                  if (trimmed) {
                    const normalized =
                      countries.find(
                        (c) => c.toLowerCase() === trimmed.toLowerCase()
                      ) || trimmed;
                    handleChange(
                      Array.from(new Set([...selectedTags, normalized]))
                    );
                    setLocationInput("");
                  }
                }
                if (e.key === "Escape") setShowLocationSuggestions(false);
              }}
            />
            {showLocationSuggestions && filteredCountries.length > 0 && (
              <div className="location-suggestions">
                {filteredCountries.map((item) => (
                  <div
                    key={item}
                    className="location-suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleChange(
                        Array.from(new Set([...selectedTags, item]))
                      );
                      setLocationInput("");
                      setShowLocationSuggestions(false);
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="location-tags">
            {selectedTags.map((tag, idx) => (
              <span key={idx} className="tag">
                {tag}
                <button
                  type="button"
                  className="tag-remove-btn"
                  onClick={() =>
                    handleChange(selectedTags.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove tag"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      );
    }
    case "tags": {
      const selectedInterests = value || field.default || [];
      const filteredInterests = (field.suggestions || [])
        .filter((it) =>
          it.toLowerCase().includes(interestInput.trim().toLowerCase())
        )
        .slice(0, 8);
      return (
        <div key={field.name}>
          <div className="targeting-input-wrapper" ref={interestRef}>
            <input
              type="text"
              className="targeting-input"
              placeholder={field.placeholder}
              value={interestInput}
              onChange={(e) => {
                setInterestInput(e.target.value);
                setShowInterestSuggestions(true);
              }}
              onFocus={() => setShowInterestSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const trimmed = interestInput.replace(/,$/, "").trim();
                  if (trimmed) {
                    handleChange(
                      Array.from(new Set([...selectedInterests, trimmed]))
                    );
                    setInterestInput("");
                  }
                }
                if (e.key === "Escape") setShowInterestSuggestions(false);
              }}
            />
            {showInterestSuggestions && filteredInterests.length > 0 && (
              <div className="targeting-suggestions">
                {filteredInterests.map((item) => (
                  <div
                    key={item}
                    className="targeting-suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleChange(
                        Array.from(new Set([...selectedInterests, item]))
                      );
                      setInterestInput("");
                      setShowInterestSuggestions(false);
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="targeting-tags">
            {selectedInterests.map((interest, idx) => (
              <span key={idx} className="tag">
                {interest}
                <button
                  type="button"
                  className="tag-remove-btn"
                  onClick={() =>
                    handleChange(selectedInterests.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove interest"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      );
    }
    case "info": {
      const content =
        typeof field.content === "function"
          ? field.content(adset)
          : field.content;
      if (!content) return null;
      return (
        <div className="bid-strategy-info" key={`info-${field.content}`}>
          <div className="info-box">
            <i className="info-icon"></i>
            <span> {content}</span>
          </div>
        </div>
      );
    }
    default: {
      return null;
    }
  }
}
const AdsetStepInner = forwardRef(
  ({ adset, setAdset, objective, mode, facebookPages = [] }, ref) => {
    const toast = useToast();
    const schema = SCHEMA_MAP[objective] || SCHEMA_MAP.AWARENESS;
    const [showPageSelect, setShowPageSelect] = useState(false);

    useEffect(() => {
      const defaults = getAdsetDefaultsByObjective(objective);
      if (defaults) {
        setAdset((prev) => ({
          ...prev,
          optimization_goal:
            prev.optimization_goal || defaults.optimization_goal,
          billing_event: prev.billing_event || defaults.billing_event,
        }));
      }
    }, [objective, setAdset]);

    // Handler for changing Facebook Page (defined BEFORE useEffect that uses it)
    const handlePageChange = useCallback(
      (selectedPage) => {
        setAdset((prev) => ({
          ...prev,
          facebookPageId: selectedPage.id,
          facebookPage: selectedPage.name,
          promoted_object: {
            ...prev.promoted_object,
            page_id: selectedPage.id,
          },
        }));
        setShowPageSelect(false);
      },
      [setAdset]
    );

    // Auto-select first Facebook Page if none selected for ENGAGEMENT/LEADS/AWARENESS/SALES
    useEffect(() => {
      const needsPage =
        objective === "ENGAGEMENT" ||
        objective === "LEADS" ||
        objective === "AWARENESS" ||
        objective === "SALES";

      if (needsPage && facebookPages.length > 0 && !adset.facebookPageId) {
        handlePageChange(facebookPages[0]);
      }
    }, [objective, facebookPages, adset.facebookPageId, handlePageChange]);

    useImperativeHandle(
      ref,
      () => ({
        validate: () => {
          let isValid = true;
          schema.sections.forEach((section) => {
            section.fields.forEach((field) => {
              if (field.visibleIf && !field.visibleIf(adset)) return;
              if (typeof field.validate === "function") {
                const val = getValue(adset, field.name || field.nameMin);
                const result = field.validate(val, adset);
                if (result !== true) {
                  toast.warning(result);
                  isValid = false;
                }
              }
            });
          });
          return isValid;
        },
      }),
      [adset, schema, toast]
    );

    // Show Facebook Page selector for objectives that need it
    // Tất cả objectives đều cần page_id cho Creative, vì Facebook API luôn yêu cầu object_story_spec.page_id
    const needsFacebookPage =
      objective === "ENGAGEMENT" ||
      objective === "LEADS" ||
      objective === "AWARENESS" ||
      objective === "SALES" ||
      objective === "TRAFFIC" ||
      objective === "APP_PROMOTION";

    // Guard: ensure optimization_goal compatible with current objective
    useEffect(() => {
      const goals = getOptimizationGoals(objective);
      const allowedValues = goals.map((g) => g.value);
      if (!allowedValues.length) return;
      if (
        !adset.optimization_goal ||
        !allowedValues.includes(adset.optimization_goal)
      ) {
        const newGoal = goals[0].value;
        const newBilling =
          getCompatibleBillingEvents(objective, newGoal)[0] || "IMPRESSIONS";
        setAdset((prev) => ({
          ...prev,
          optimization_goal: newGoal,
          billing_event: newBilling,
        }));
        toast?.info(
          "Đã tự động đặt lại mục tiêu hiệu quả phù hợp với mục tiêu chiến dịch."
        );
      }
    }, [objective]);

    return (
      <div className="adset-step">
        <div className="step-content">
          {/* Facebook Page Selector for ENGAGEMENT/LEADS/AWARENESS/SALES */}
          {needsFacebookPage && (
            <div className="config-section">
              <div className="section-header-ads">
                <Facebook size={16} color="#2563eb" />
                <h3 className="section-title-ads">Trang Facebook</h3>
              </div>
              <div
                className="facebook-page-selector"
                style={{ cursor: "pointer", position: "relative" }}
                onClick={() => setShowPageSelect((prev) => !prev)}
              >
                {facebookPages.length > 0 ? (
                  (() => {
                    const current = facebookPages.find(
                      (p) => p.id === adset.facebookPageId
                    );
                    return (
                      <>
                        <img
                          src={current?.avatar || no_avatar}
                          alt={current?.name || "Facebook Page"}
                          className="page-logo"
                        />
                        <div className="page-info">
                          <div className="page-type">Trang Facebook</div>
                          <div className="page-name">
                            {current?.name || "Chưa chọn Page"}
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="page-info">
                    <div className="page-type">Trang Facebook</div>
                    <div className="page-name">Chưa có Page nào</div>
                  </div>
                )}

                {showPageSelect && facebookPages.length > 0 && (
                  <div
                    className="dropdown-list"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    {facebookPages.map((p) => (
                      <div
                        key={p.id}
                        className="dropdown-item-campaign"
                        onClick={() => handlePageChange(p)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                          background:
                            adset.facebookPageId === p.id ? "#f3f4f6" : "white",
                          zIndex: 9999,
                        }}
                      >
                        <img
                          src={p.avatar}
                          alt={p.name}
                          style={{ width: 28, height: 28, borderRadius: "50%" }}
                        />
                        <span>{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Schema-driven sections */}
          {schema.sections.map((section) => {
            const IconComp = section.icon ? ICON_MAP[section.icon] : null;
            const isHorizontal = section.layout === "horizontal";
            const visibleFields = (section.fields || []).filter(
              (f) => !f.visibleIf || f.visibleIf(adset)
            );

            if (visibleFields.length === 0) return null;

            return (
              <div
                key={section.id}
                className={
                  isHorizontal ? "config-section-datetime" : "config-section"
                }
              >
                {isHorizontal ? (
                  <>
                    {section.fields[0] && (!section.fields[0].visibleIf || section.fields[0].visibleIf(adset)) && (
                      <div className="left-custom">
                        <div className="section-header-ads">
                          {IconComp && <IconComp size={16} color="#2563eb" />}
                          <h3 className="section-title-ads">
                            {section.fields[0]?.label || section.title}
                          </h3>
                          {mode === "edit" && section.fields[0]?.lockMessage && (
                            <span className="field-locked-badge">
                              {section.fields[0].lockMessage}
                            </span>
                          )}
                        </div>
                        <FieldRenderer
                          field={section.fields[0]}
                          adset={adset}
                          setAdset={setAdset}
                          objective={objective}
                          mode={mode}
                        />
                      </div>
                    )}
                    {section.fields[1] && (!section.fields[1].visibleIf || section.fields[1].visibleIf(adset)) && (
                      <div className="right-custom">
                        <div className="section-header-ads">
                          {IconComp && <IconComp size={16} color="#2563eb" />}
                          <h3 className="section-title-ads">
                            {section.fields[1]?.label || ""}
                          </h3>
                        </div>
                        <FieldRenderer
                          field={section.fields[1]}
                          adset={adset}
                          setAdset={setAdset}
                          objective={objective}
                          mode={mode}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className={
                        section.id === "name"
                          ? "section-header-adset"
                          : "section-header-ads"
                      }
                    >
                      {IconComp && (
                        <IconComp
                          size={section.id === "name" ? 8 : 16}
                          fill={section.id === "name" ? "#2563eb" : "none"}
                          color="#2563eb"
                        />
                      )}
                      <h3 className="section-title-ads">{section.title}</h3>
                    </div>
                    {section.id === "budget" ? (
                      <div className="budget-row">
                        {section.fields.map((field, idx) => (
                          <FieldRenderer
                            key={idx}
                            field={field}
                            adset={adset}
                            setAdset={setAdset}
                            objective={objective}
                            mode={mode}
                          />
                        ))}
                      </div>
                    ) : section.id === "targeting" ? (
                      <div className="audience-fields">
                        {section.fields.map((field, idx) => (
                          <FieldRenderer
                            key={idx}
                            field={field}
                            adset={adset}
                            setAdset={setAdset}
                            objective={objective}
                            mode={mode}
                          />
                        ))}
                      </div>
                    ) : (
                      section.fields.map((field, idx) => (
                        <FieldRenderer
                          key={idx}
                          field={field}
                          adset={adset}
                          setAdset={setAdset}
                          objective={objective}
                          mode={mode}
                        />
                      ))
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

const AdsetStep = forwardRef((props, ref) => {
  return <AdsetStepInner ref={ref} {...props} />;
});

export default AdsetStep;
