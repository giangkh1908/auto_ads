/**
 * Utility functions cho CTA conversion
 */
import { CTA_VI_TO_FB_TYPE, CTA_FB_TYPE_TO_VI, DEFAULT_CTA, DEFAULT_CTA_FB_TYPE } from '../../constants/ctaConstants';

/**
 * Convert CTA tiếng Việt → Facebook API Type
 * @param {string} ctaVi - CTA text tiếng Việt
 * @returns {string} - Facebook API CTA type
 */
export function convertCTAToFacebookType(ctaVi) {
  if (!ctaVi) return DEFAULT_CTA_FB_TYPE;
  
  // Nếu đã là Facebook type rồi (từ DB hoặc API), trả về nguyên vẹn
  if (CTA_FB_TYPE_TO_VI[ctaVi]) {
    return ctaVi;
  }
  
  // Convert từ tiếng Việt sang Facebook type
  return CTA_VI_TO_FB_TYPE[ctaVi] || DEFAULT_CTA_FB_TYPE;
}

/**
 * Convert Facebook API Type → CTA tiếng Việt
 * @param {string} fbType - Facebook API CTA type
 * @returns {string} - CTA text tiếng Việt
 */
export function convertFacebookTypeToCTA(fbType) {
  if (!fbType) return DEFAULT_CTA;
  
  // Nếu đã là tiếng Việt rồi, trả về nguyên vẹn
  if (CTA_VI_TO_FB_TYPE[fbType]) {
    return fbType;
  }
  
  // Convert từ Facebook type sang tiếng Việt
  return CTA_FB_TYPE_TO_VI[fbType] || DEFAULT_CTA;
}

/**
 * Validate CTA value
 * @param {string} cta - CTA value để validate
 * @returns {boolean}
 */
export function isValidCTA(cta) {
  if (!cta) return false;
  return CTA_VI_TO_FB_TYPE.hasOwnProperty(cta) || CTA_FB_TYPE_TO_VI.hasOwnProperty(cta);
}

