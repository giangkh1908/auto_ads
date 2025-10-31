import { useState, useEffect } from "react";
import profileService from "../services/profileService";
import { useToast } from "./useToast";

/**
 * Custom hook để quản lý Facebook pages
 */
export function useFacebookPages() {
  const [facebookPages, setFacebookPages] = useState([]);
  const toast = useToast();

  useEffect(() => {
    const loadPages = async () => {
      try {
        // Lấy thông tin shop hiện tại và các page đã kết nối
        const me = await profileService.getCurrentProfile();
        const shop = me?.data?.shop || me?.shop;
        const connectedPages = Array.isArray(shop?.facebook_pages)
          ? shop.facebook_pages
              .filter((p) => p.connected_status === "connected")
              .map((p) => ({
                id: p.page_id,
                name: p.page_info?.name || "Facebook Page",
                avatar:
                  p.page_info?.picture_url ||
                  `https://graph.facebook.com/${p.page_id}/picture?type=square`,
              }))
          : [];
        setFacebookPages(connectedPages);
      } catch (e) {
        // silent fail; selection will just be empty
        console.log("Failed to load connected facebook pages", e);
        toast.error("Không tải được danh sách Page", {
          description: "Vui lòng kiểm tra kết nối mạng và thử lại",
        });
      }
    };
    loadPages();
  }, [toast]);

  return facebookPages;
}
