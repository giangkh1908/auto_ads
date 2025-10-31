import { useState, useCallback } from 'react';

/**
 * Custom hook để quản lý progress state
 * Dùng cho tất cả các thao tác async: create, update, delete, load, sync
 */
export function useProgressState() {
  const [progressState, setProgressState] = useState({
    isOpen: false,
    type: 'create',
    title: '',
    progress: {
      status: 'idle',
      current: 0,
      total: 0,
      percentage: 0,
      message: '',
      details: [],
      errors: [],
      successCount: 0,
      errorCount: 0,
    },
  });

  /**
   * Mở progress popup
   * @param {object} params - {type, title, total}
   */
  const openProgress = useCallback(({ type, title, total }) => {
    setProgressState({
      isOpen: true,
      type,
      title,
      progress: {
        status: 'loading',
        current: 0,
        total,
        percentage: 0,
        message: 'Đang khởi tạo...',
        details: [],
        errors: [],
        successCount: 0,
        errorCount: 0,
      },
    });
  }, []);

  /**
   * Update progress
   * @param {object} updates - Partial updates cho progress object
   */
  const updateProgress = useCallback((updates) => {
    setProgressState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        ...updates,
        // Auto-calculate percentage nếu có current và total
        percentage: updates.current !== undefined && prev.progress.total > 0
          ? Math.round((updates.current / prev.progress.total) * 100)
          : updates.percentage !== undefined
          ? updates.percentage
          : prev.progress.percentage,
      },
    }));
  }, []);

  /**
   * Đóng progress popup
   */
  const closeProgress = useCallback(() => {
    setProgressState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  /**
   * Reset progress về trạng thái ban đầu
   */
  const resetProgress = useCallback(() => {
    setProgressState({
      isOpen: false,
      type: 'create',
      title: '',
      progress: {
        status: 'idle',
        current: 0,
        total: 0,
        percentage: 0,
        message: '',
        details: [],
        errors: [],
        successCount: 0,
        errorCount: 0,
      },
    });
  }, []);

  /**
   * Set progress thành công
   * @param {object} data - {successCount, message}
   */
  const setProgressSuccess = useCallback((data = {}) => {
    setProgressState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        status: 'success',
        current: prev.progress.total,
        percentage: 100,
        message: data.message || 'Hoàn thành!',
        successCount: data.successCount || prev.progress.total,
        errorCount: 0,
      },
    }));
  }, []);

  /**
   * Set progress lỗi
   * @param {object} data - {message, errors}
   */
  const setProgressError = useCallback((data = {}) => {
    setProgressState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        status: 'error',
        message: data.message || 'Có lỗi xảy ra',
        errors: data.errors || [],
      },
    }));
  }, []);

  /**
   * Set progress partial (một phần thành công, một phần lỗi)
   * @param {object} data - {successCount, errorCount, errors, message}
   */
  const setProgressPartial = useCallback((data = {}) => {
    setProgressState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        status: 'partial',
        current: prev.progress.total,
        percentage: 100,
        message: data.message || 'Hoàn thành với một số lỗi',
        successCount: data.successCount || 0,
        errorCount: data.errorCount || 0,
        errors: data.errors || [],
      },
    }));
  }, []);

  return {
    progressState,
    openProgress,
    updateProgress,
    closeProgress,
    resetProgress,
    setProgressSuccess,
    setProgressError,
    setProgressPartial,
  };
}

