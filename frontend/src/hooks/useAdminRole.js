import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { isAdminRole, getTabsForRole, getRolePath, ADMIN_ROLES } from "../constants/adminConstants";

/**
 * Hook to get admin role information from user
 * @returns {Object} Admin role data and helper functions
 */
export const useAdminRole = () => {
  const { user } = useAuth();

  const adminData = useMemo(() => {
    if (!user || !user.internal_role) {
      return {
        isAdmin: false,
        internalRole: null,
        rolePath: null,
        tabs: [],
      };
    }

    const internalRole = user.internal_role;
    const isAdmin = isAdminRole(internalRole);

    return {
      isAdmin,
      internalRole,
      rolePath: getRolePath(internalRole),
      tabs: getTabsForRole(internalRole),
    };
  }, [user]);

  return adminData;
};

/**
 * Hook to check if current user is admin
 * @returns {boolean}
 */
export const useIsAdmin = () => {
  const { isAdmin } = useAdminRole();
  return isAdmin;
};

