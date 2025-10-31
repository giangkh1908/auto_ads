import { useState, useCallback } from 'react';
import { useToast } from './useToast';
import { toggleEntityStatus } from '../services/toggleStatusService';
import { deleteCampaign, deleteAdSet, deleteAd } from '../services/adService';

/**
 * Custom hook để quản lý actions (toggle, delete, archive)
 * Xử lý: toggle status, delete entities, archive entities
 * @param {object} datasets - Dữ liệu campaigns, adsets, ads
 * @param {function} setDatasets - Update datasets
 * @param {function} onRefresh - Callback để refresh data sau khi xóa thành công
 */
export function useAdsActions(datasets, setDatasets, onRefresh) {
  const toast = useToast();
  const [togglingItems, setTogglingItems] = useState(new Set());
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: 'delete',
    title: '',
    message: '',
    onConfirm: null,
    isLoading: false
  });

  // ✅ Progress Popup State
  const [progressPopup, setProgressPopup] = useState({
    isOpen: false,
    type: 'delete',
    title: '',
    progress: {
      status: 'idle', // 'idle' | 'loading' | 'success' | 'error' | 'partial'
      current: 0,
      total: 0,
      percentage: 0,
      message: '',
      successCount: 0,
      errorCount: 0,
      errors: []
    }
  });

  /**
   * Toggle entity status (ON/OFF)
   */
  const toggleRow = useCallback(async (id, activeTab) => {
    const key = activeTab === 'campaigns' ? 'campaigns' 
      : activeTab === 'adsets' ? 'adsets' : 'ads';
    const entityType = activeTab.slice(0, -1);
    const row = datasets[key].find(r => r.id === id);

    if (!row) {
      toast.error('Không tìm thấy item để toggle');
      return;
    }

    if (!row.external_id) {
      toast.warning('Không thể đồng bộ với Facebook', {
        description: 'Item chưa có external_id từ Facebook'
      });
      return;
    }

    const newStatus = !row.enabled;
    const facebookStatus = newStatus ? 'ACTIVE' : 'PAUSED';
    const displayStatus = newStatus ? 'Hoạt động' : 'Tạm dừng';

    // Add to loading state
    setTogglingItems(prev => new Set(prev).add(id));

    // Optimistic update
    setDatasets(prev => ({
      ...prev,
      [key]: prev[key].map(r => r.id !== id ? r : {
        ...r,
        enabled: newStatus,
        status: displayStatus
      })
    }));

    try {
      await toggleEntityStatus(entityType, row.external_id, facebookStatus);
      toast.success(
        `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} đã ${newStatus ? 'bật' : 'tắt'}`
      );
    } catch (error) {
      // Revert on error
      setDatasets(prev => ({
        ...prev,
        [key]: prev[key].map(r => r.id !== id ? r : {
          ...r,
          enabled: !newStatus,
          status: !newStatus ? 'Hoạt động' : 'Tạm dừng'
        })
      }));
      toast.error(`Lỗi ${newStatus ? 'bật' : 'tắt'} ${entityType}`, {
        description: error.message
      });
    } finally {
      setTogglingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, [datasets, setDatasets, toast]);

  /**
   * Handle delete action
   */
  const handleDelete = useCallback((id, activeTab) => {
    const key = activeTab === 'campaigns' ? 'campaigns' 
      : activeTab === 'adsets' ? 'adsets' : 'ads';
    const entityName = key === 'campaigns' ? 'chiến dịch' 
      : key === 'adsets' ? 'nhóm quảng cáo' : 'quảng cáo';

    const idsToDelete = id 
      ? [id]
      : datasets[key].filter(item => item.isChecked).map(item => item.id);

    if (idsToDelete.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một mục để xóa.');
      return;
    }

    setConfirmationPopup({
      isOpen: true,
      type: 'delete',
      title: `Xóa ${idsToDelete.length} ${entityName}`,
      message: `Bạn có chắc muốn xóa ${idsToDelete.length} ${entityName}? Hành động này không thể hoàn tác.`,
      onConfirm: () => executeDelete(idsToDelete, key, entityName),
      isLoading: false
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, toast]);

  /**
   * Execute delete với ProgressPopup
   */
  const executeDelete = useCallback(async (idsToDelete, key, entityName) => {
    // 1️⃣ Đóng ConfirmationPopup
    setConfirmationPopup(prev => ({
      ...prev,
      isLoading: false,
      isOpen: false
    }));

    // 2️⃣ Mở ProgressPopup
    setProgressPopup({
      isOpen: true,
      type: 'delete',
      title: `Xóa ${idsToDelete.length} ${entityName}`,
      progress: {
        status: 'loading',
        current: 0,
        total: idsToDelete.length,
        percentage: 0,
        message: `Đang xóa 0/${idsToDelete.length} ${entityName}...`,
        successCount: 0,
        errorCount: 0,
        errors: []
      }
    });

    try {
      const fbToken = localStorage.getItem('fb_access_token') || null;
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // 3️⃣ Xóa từng item và update progress
      for (let i = 0; i < idsToDelete.length; i++) {
        const delId = idsToDelete[i];
        
        try {
          if (key === 'campaigns') await deleteCampaign(delId, fbToken);
          else if (key === 'adsets') await deleteAdSet(delId, fbToken);
          else await deleteAd(delId, fbToken);
          
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            id: delId,
            error: error?.response?.data?.message || error.message
          });
        }

        // Update progress
        const current = i + 1;
        const percentage = Math.round((current / idsToDelete.length) * 100);
        
        setProgressPopup(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            current,
            percentage,
            message: `Đang xóa ${current}/${idsToDelete.length} ${entityName}...`,
            successCount,
            errorCount
          }
        }));
      }

      // 4️⃣ Update datasets (chỉ xóa items thành công)
      const successIds = idsToDelete.filter((id) => 
        !errors.find(e => e.id === id)
      );
      
      setDatasets(prev => ({
        ...prev,
        [key]: prev[key].filter(item => !successIds.includes(item.id))
      }));

      // 5️⃣ Set final status
      if (errorCount === 0) {
        setProgressPopup(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            status: 'success',
            percentage: 100,
            message: `Đã xóa ${successCount} ${entityName} thành công!`
          }
        }));
        toast.success(`Đã xóa ${successCount} ${entityName} thành công!`);
        
        // ✅ Auto refresh data sau khi xóa thành công
        if (onRefresh) {
          console.log('🔄 Auto refreshing data after delete...');
          setTimeout(() => {
            onRefresh();
          }, 2000); // Delay 2s để user thấy success message
        }
      } else if (successCount === 0) {
        setProgressPopup(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            status: 'error',
            percentage: 100,
            message: `Xóa thất bại!`,
            errors
          }
        }));
        toast.error(`Xóa thất bại! Có ${errorCount} lỗi.`);
      } else {
        setProgressPopup(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            status: 'partial',
            percentage: 100,
            message: `Đã xóa ${successCount}/${idsToDelete.length} ${entityName}`,
            errors
          }
        }));
        toast.warning(`Xóa thành công ${successCount}/${idsToDelete.length}. Có ${errorCount} lỗi.`);
        
        // ✅ Auto refresh data sau khi xóa một phần thành công
        if (onRefresh && successCount > 0) {
          console.log('🔄 Auto refreshing data after partial delete...');
          setTimeout(() => {
            onRefresh();
          }, 2000); // Delay 2s để user thấy warning message
        }
      }

    } catch (error) {
      console.error('❌ Lỗi khi xóa:', error);
      setProgressPopup(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          status: 'error',
          percentage: 0,
          message: error?.response?.data?.message || 'Xóa thất bại!'
        }
      }));
      toast.error('Xóa thất bại, vui lòng thử lại!');
    }
  }, [setDatasets, toast, onRefresh]);

  /**
   * Handle archive action
   */
  const handleArchive = useCallback((id, activeTab) => {
    const key = activeTab === 'campaigns' ? 'campaigns' 
      : activeTab === 'adsets' ? 'adsets' : 'ads';
    const entityName = key === 'campaigns' ? 'chiến dịch' 
      : key === 'adsets' ? 'nhóm quảng cáo' : 'quảng cáo';

    const idsToArchive = id
      ? [id]
      : datasets[key].filter(item => item.isChecked).map(item => item.id);

    if (idsToArchive.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một mục để lưu trữ.');
      return;
    }

    setConfirmationPopup({
      isOpen: true,
      type: 'archive',
      title: `Lưu trữ ${idsToArchive.length} ${entityName}`,
      message: `Bạn có chắc muốn lưu trữ ${idsToArchive.length} ${entityName}? Hành động này có thể được hoàn tác.`,
      onConfirm: () => executeArchive(idsToArchive, activeTab),
      isLoading: false
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, toast]);

  /**
   * Execute archive (placeholder)
   */
  const executeArchive = useCallback(async (idsToArchive, activeTab) => {
    setConfirmationPopup(prev => ({ ...prev, isLoading: true }));

    try {
      // TODO: Implement archive API calls
      console.log(`Lưu trữ ${idsToArchive.length} items:`, idsToArchive);
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success(`Đã lưu trữ ${idsToArchive.length} ${activeTab} thành công!`);
    } catch (error) {
      console.error('❌ Lỗi khi lưu trữ:', error);
      toast.error('Lưu trữ thất bại, vui lòng thử lại!');
    } finally {
      setConfirmationPopup(prev => ({
        ...prev,
        isLoading: false,
        isOpen: false
      }));
    }
  }, [toast]);

  return {
    togglingItems,
    toggleRow,
    handleDelete,
    handleArchive,
    confirmationPopup,
    setConfirmationPopup,
    progressPopup,        // ✅ NEW: Progress Popup state
    setProgressPopup      // ✅ NEW: Progress Popup setter
  };
}

