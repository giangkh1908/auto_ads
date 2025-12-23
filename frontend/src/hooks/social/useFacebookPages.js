import { useState, useEffect } from "react";
import profileService from "../../services/auth/profileService";
import { useToast } from "../common/useToast";

/**
 * Custom hook để quản lý Facebook pages
 * Lấy danh sách pages từ Shop hiện tại của user
 */
export function useFacebookPages() {
  const [facebookPages, setFacebookPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const loadPages = async () => {
      try {
        setLoading(true);
        // Lấy thông tin shop hiện tại và các page đã kết nối
        const me = await profileService.getCurrentProfile();

        // Ưu tiên lấy từ Shop (nguồn chính)
        // Shop model có facebook_pages với page_info.name
        const shop = me?.data?.shop || me?.shop;
        const shopUser = me?.data?.shopUser || me?.shopUser;

        // Lấy danh sách page mà user hiện tại có quyền (giống Dashboard)
        const shopUserPages = Array.isArray(shopUser?.facebook_pages)
          ? shopUser.facebook_pages
          : [];
        const userAccessiblePageIds = new Set(
          shopUserPages
            .filter(
              (p) =>
                p.connected_status === "connected" &&
                p.page_status !== "pause"
            )
            .map((p) => p.page_id)
        );
        const userHasRestriction = userAccessiblePageIds.size > 0;

        // Lấy pages từ Shop trước (nguồn chính)
        let pagesSource = Array.isArray(shop?.facebook_pages)
          ? shop.facebook_pages
          : [];

        // Nếu shop không có pages, fallback về shopUser
        if (!pagesSource.length && shopUserPages.length) {
          pagesSource = shopUserPages;
        }

        // Lọc và map pages
        const connectedPages = pagesSource
          .filter((p) => {
            const isConnected =
              p.connected_status === "connected" && p.page_status !== "pause";
            if (!isConnected) return false;
            // Nếu user có danh sách quyền cụ thể → chỉ hiển thị các page user được cấp quyền
            if (userHasRestriction) {
              return userAccessiblePageIds.has(p.page_id);
            }
            // Nếu không có restriction (admin) → hiển thị tất cả
            return true;
          })
          .map((p) => ({
            id: p.page_id,
            // Ưu tiên page_name từ ShopUser, fallback về page_info.name từ Shop
            name: p.page_name || p.page_info?.name || "Facebook Page",
            avatar:
              p.picture_url ||
              p.page_info?.picture_url ||
              `https://graph.facebook.com/${p.page_id}/picture?type=square`,
          }));

        setFacebookPages(connectedPages);
      } catch (e) {
        // silent fail; selection sẽ rỗng
        console.error("Failed to load connected facebook pages from Shop:", e);
        toast.error("Không tải được danh sách Page", {
          description: "Vui lòng kiểm tra kết nối mạng và thử lại",
        });
        setFacebookPages([]);
      } finally {
        setLoading(false);
      }
    };
    loadPages();
  }, [toast]);

  return { facebookPages, loading };
}
