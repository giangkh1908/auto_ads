import { Users, Package, CreditCard, FileText, DollarSign, Monitor } from "lucide-react";

/**
 * Admin Roles Constants
 * Định nghĩa các internal_role từ user model
 */
export const ADMIN_ROLES = {
  CS_STAFF: "CS Staff",
  ACCOUNTANT: "Accountant",
  SYSTEM_ADMIN: "System Admin"
};

/**
 * Role to Route Path Mapping
 * Map internal_role sang route path prefix
 */
export const ADMIN_ROLE_PATHS = {
  "CS Staff": "cs-staff",
  "Accountant": "accountant",
  "System Admin": "system-admin"
};

/**
 * Admin Tabs Configuration
 * Định nghĩa tabs cho mỗi role
 */
export const ADMIN_TABS = {
  "CS Staff": [
    { 
      name: 'Leads', 
      path: '/admin/cs-staff/leads', 
      icon: Users 
    },
    { 
      name: 'Service Package', 
      path: '/admin/cs-staff/service-package', 
      icon: Package 
    },
    { 
      name: 'Payment', 
      path: '/admin/cs-staff/payment', 
      icon: CreditCard 
    }
  ],
  "Accountant": [
    { 
      name: 'Transactions', 
      path: '/admin/accountant/transactions', 
      icon: CreditCard 
    },
    { 
      name: 'Payment Reports', 
      path: '/admin/accountant/reports', 
      icon: FileText 
    }
  ],
  "System Admin": [
    { 
      name: 'Payment Management', 
      path: '/admin/system-admin/payment-management', 
      icon: DollarSign 
    },
    { 
      name: 'User Management', 
      path: '/admin/system-admin/user-management', 
      icon: Users 
    },
    { 
      name: 'System Monitoring', 
      path: '/admin/system-admin/system-monitoring', 
      icon: Monitor 
    }
  ]
};

/**
 * Helper function to check if a role is admin
 */
export const isAdminRole = (internalRole) => {
  return internalRole && Object.values(ADMIN_ROLES).includes(internalRole);
};

/**
 * Helper function to get role path prefix
 */
export const getRolePath = (internalRole) => {
  return ADMIN_ROLE_PATHS[internalRole] || null;
};

/**
 * Helper function to get tabs for a role
 */
export const getTabsForRole = (internalRole) => {
  return ADMIN_TABS[internalRole] || [];
};

/**
 * Helper function to get default admin route for a role
 * Returns the first tab's path for the role, or null if not admin
 */
export const getDefaultAdminRoute = (internalRole) => {
  if (!internalRole || !isAdminRole(internalRole)) {
    return null;
  }
  const tabs = getTabsForRole(internalRole);
  return tabs.length > 0 ? tabs[0].path : null;
};

