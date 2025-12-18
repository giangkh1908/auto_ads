import axiosInstance from '../../utils/api/axios';

export const aiConfigService = {
  async getConfigs(include = 'own,templates') {
    const response = await axiosInstance.get('/api/ai/configs', {
      params: { include }
    });
    return response.data;
  },

  async getConfig(id) {
    const response = await axiosInstance.get(`/api/ai/configs/${id}`);
    return response.data;
  },

  async createConfig(configData) {
    const response = await axiosInstance.post('/api/ai/configs', configData);
    return response.data;
  },

  async updateConfig(id, configData) {
    const response = await axiosInstance.put(`/api/ai/configs/${id}`, configData);
    return response.data;
  },

  async deleteConfig(id) {
    const response = await axiosInstance.delete(`/api/ai/configs/${id}`);
    return response.data;
  },

  async setDefaultConfig(id) {
    const response = await axiosInstance.post(`/api/ai/configs/${id}/set-default`);
    return response.data;
  },

  async previewPrompt(id, target = 'headline', maxLen = 60) {
    const response = await axiosInstance.get(`/api/ai/configs/${id}/preview-prompt`, {
      params: { target, max_len: maxLen }
    });
    return response.data;
  },
};

