import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, UserCog, FileText, ClipboardList } from 'lucide-react';
import './AdminSidebar.css';

export default function AdminSidebar() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  
  // Check if we're in User Management section
  const isUserManagement = currentPath.startsWith('/admin/system-admin/user-management');
  const isCustomer = currentPath === '/admin/system-admin/user-management';
  const isInternal = currentPath.startsWith('/admin/system-admin/user-management/internal');
  
  // Check if we're in System Monitoring section
  const isSystemMonitoring = currentPath.startsWith('/admin/system-admin/system-monitoring');
  const isSystemLog = currentPath === '/admin/system-admin/system-monitoring' || currentPath === '/admin/system-admin/system-monitoring/system-log';
  const isCustomerLog = currentPath.startsWith('/admin/system-admin/system-monitoring/customer-log');

  // Render User Management navigation tabs
  if (isUserManagement) {
    return (
      <nav className="admin-sidebar-nav">
        <div className="admin-sidebar-tabs">
          <button
            className={`admin-sidebar-tab ${isCustomer ? 'active' : ''}`}
            onClick={() => navigate('/admin/system-admin/user-management')}
          >
            <Users size={18} />
            <span>{t('sidebar.customer')}</span>
          </button>
          <button
            className={`admin-sidebar-tab ${isInternal ? 'active' : ''}`}
            onClick={() => navigate('/admin/system-admin/user-management/internal')}
          >
            <UserCog size={18} />
            <span>{t('sidebar.internal')}</span>
          </button>
        </div>
      </nav>
    );
  }

  // Render System Monitoring navigation tabs
  if (isSystemMonitoring) {
    return (
      <nav className="admin-sidebar-nav">
        <div className="admin-sidebar-tabs">
          <button
            className={`admin-sidebar-tab ${isSystemLog ? 'active' : ''}`}
            onClick={() => navigate('/admin/system-admin/system-monitoring')}
          >
            <FileText size={18} />
            <span>{t('sidebar.systemLog')}</span>
          </button>
          <button
            className={`admin-sidebar-tab ${isCustomerLog ? 'active' : ''}`}
            onClick={() => navigate('/admin/system-admin/system-monitoring/customer-log')}
          >
            <ClipboardList size={18} />
            <span>{t('sidebar.customerLog')}</span>
          </button>
        </div>
      </nav>
    );
  }

  // Default: no navigation tabs
  return null;
}


