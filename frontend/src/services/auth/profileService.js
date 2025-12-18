import axiosInstance from "../../utils/api/axios";

const PROFILE_ENDPOINTS = {
  GET_PROFILE: "/api/auth/me",
  UPDATE_PROFILE: "/api/auth/me",
  CHANGE_PASSWORD: "/api/auth/change-password",
};

// Xử lý lỗi chuẩn cho service
function handleError(error) {
  return error;
}

// Chuẩn hóa payload gửi lên backend theo schema của API
function buildUpdatePayload(input) {
  const payload = {};
  if (input?.full_name) payload.full_name = input.full_name;
  if (input?.phone) payload.phone = input.phone;

  // country là field cấp cao nhất trong user.model.js
  if (typeof input?.country === "string") payload.country = input.country;

  // profile: address, bio
  const profile = {};
  // if (typeof input?.profile?.address === 'string') profile.address = input.profile.address
  // if (typeof input?.profile?.bio === 'string') profile.bio = input.profile.bio
  if (Object.keys(profile).length > 0) payload.profile = profile;

  return payload;
}

export const profileService = {
  // Lấy thông tin profile hiện tại
  getCurrentProfile: async () => {
    try {
      const response = await axiosInstance.get(PROFILE_ENDPOINTS.GET_PROFILE);
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  // Cập nhật thông tin profile
  updateProfile: async (profileData) => {
    try {
      const payload = buildUpdatePayload(profileData);
      const response = await axiosInstance.put(
        PROFILE_ENDPOINTS.UPDATE_PROFILE,
        payload
      );
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  // 🔹 Đổi mật khẩu
  changePassword: async (passwordData) => {
    try {
      const response = await axiosInstance.post(
        PROFILE_ENDPOINTS.CHANGE_PASSWORD,
        passwordData
      );
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },
};

export default profileService;
