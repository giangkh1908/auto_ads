export const formatValue = (value, format) => {
  if (value === null || value === undefined) return '-';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(value);
    case 'number':
      return new Intl.NumberFormat('vi-VN').format(value);
    case 'percent':
      return `${Number(value).toFixed(2)}%`;
    case 'text':
    default:
      return value;
  }
};
