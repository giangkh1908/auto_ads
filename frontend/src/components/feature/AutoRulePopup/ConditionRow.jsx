import { X, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  METRICS_OPTIONS,
  OPERATORS_OPTIONS,
  getAvailableUnits,
  getMetricDescription,
} from "../../../constants/autoRuleConstants";

/**
 * Condition Row Component
 */
const ConditionRow = ({
  condition,
  index,
  onChange,
  onRemove,
  onAdd,
}) => {
  const { t } = useTranslation('automationRule');
  return (
    <div className="auto-rule-popup-condition-row">
      <select
        className="auto-rule-popup-select auto-rule-popup-select-metric"
        value={condition.metric}
        onChange={(e) => onChange(index, "metric", e.target.value)}
      >
        {METRICS_OPTIONS.map((metric, idx) => (
          <option key={idx} value={metric} title={getMetricDescription(metric)}>
            {t(`metrics.${metric}`)}
          </option>
        ))}
      </select>
      <select
        className="auto-rule-popup-select auto-rule-popup-select-operator"
        value={condition.operator}
        onChange={(e) => onChange(index, "operator", e.target.value)}
      >
        {OPERATORS_OPTIONS.map((operator, idx) => (
          <option key={idx} value={operator}>
            {t(`operators.${operator}`)}
          </option>
        ))}
      </select>
      <input
        type="number"
        className="auto-rule-popup-input auto-rule-popup-input-value"
        value={condition.value}
        onChange={(e) => onChange(index, "value", e.target.value)}
        placeholder={t('conditionRow.valuePlaceholder')}
        step="any"
      />
      <select
        className="auto-rule-popup-select auto-rule-popup-select-unit"
        value={condition.unit}
        onChange={(e) => onChange(index, "unit", e.target.value)}
      >
        {getAvailableUnits(condition.metric).map((unit, idx) => (
          <option key={idx} value={unit}>
            {t(`units.${unit}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="auto-rule-popup-btn-add"
        onClick={onAdd}
      >
        <Plus size={14} />
        {t('conditionRow.addButton')}
      </button>
      <button
        type="button"
        className="auto-rule-popup-btn-remove"
        onClick={() => onRemove(index)}
        title={t('conditionRow.removeTooltip')}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ConditionRow;

