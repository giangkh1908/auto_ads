import React, { useState, useEffect } from "react";
import { Folder, Grid, FileText, X } from "lucide-react";
import axiosInstance from "../../../../utils/axios";
import { transformCampaign, transformAdset } from "../../../../pages/AdsManagement/services/adsDataService";
import "./CreateChild.css";

function CreateChild({ onClose, onSave, isFullMode = false, selectedAccountId = null }) {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  
  // Adset states
  const [adsetMode, setAdsetMode] = useState("createNew"); // "createNew" or "selectExisting"
  const [adsets, setAdsets] = useState([]);
  const [selectedAdsetId, setSelectedAdsetId] = useState("");
  const [adsetName, setAdsetName] = useState("");
  const [loadingAdsets, setLoadingAdsets] = useState(false);
  
  // Ad states - Ad luôn được tạo mới
  const [adName, setAdName] = useState("");

  // Fetch campaigns when selectedAccountId changes
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!selectedAccountId) {
        setCampaigns([]);
        return;
      }

      setLoadingCampaigns(true);
      try {
        const response = await axiosInstance.get(`/api/campaigns`, {
          params: {
            account_id: selectedAccountId,
            fetch_all: true
          }
        });

        if (response.data) {
          const { items } = response.data;
          const transformed = items.map(transformCampaign);
          // Filter out deleted and archived campaigns
          const activeCampaigns = transformed.filter(
            (campaign) => campaign.status !== "DELETED" && campaign.status !== "ARCHIVED"
          );
          setCampaigns(activeCampaigns);
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error);
        setCampaigns([]);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    fetchCampaigns();
  }, [selectedAccountId]);

  // Fetch adsets when campaign is selected and mode is "selectExisting"
  useEffect(() => {
    const fetchAdsets = async () => {
      if (!selectedCampaignId || adsetMode !== "selectExisting") {
        setAdsets([]);
        setSelectedAdsetId("");
        return;
      }

      setLoadingAdsets(true);
      try {
        const response = await axiosInstance.get(`/api/adsets`, {
          params: {
            campaign_id: selectedCampaignId,
            fetch_all: true
          }
        });

        if (response.data) {
          const { items } = response.data;
          const transformed = items.map((adset) => transformAdset(adset, selectedCampaignId));
          // Filter out deleted and archived adsets
          const activeAdsets = transformed.filter(
            (adset) => adset.status !== "DELETED" && adset.status !== "ARCHIVED"
          );
          setAdsets(activeAdsets);
        }
      } catch (error) {
        console.error("Error fetching adsets:", error);
        setAdsets([]);
      } finally {
        setLoadingAdsets(false);
      }
    };

    fetchAdsets();
  }, [selectedCampaignId, adsetMode]);

  // Reset adset selection when mode changes
  useEffect(() => {
    if (adsetMode === "createNew") {
      setSelectedAdsetId("");
      setAdsetName("");
    } else {
      setAdsetName("");
    }
  }, [adsetMode]);

  // Reset adset selection when campaign changes
  useEffect(() => {
    setSelectedAdsetId("");
    setAdsetName("");
    setAdsets([]);
  }, [selectedCampaignId]);

  // Reset ad name when adset changes
  useEffect(() => {
    setAdName("");
  }, [selectedAdsetId, adsetMode]);

  // Check if form is valid (all required fields are filled)
  const isFormValid = () => {
    // Campaign must be selected
    if (!selectedCampaignId) return false;

    // Adset must be filled based on mode
    if (adsetMode === "createNew") {
      if (!adsetName.trim()) return false;
    } else if (adsetMode === "selectExisting") {
      if (!selectedAdsetId) return false;
    }

    // Ad must be filled (always create new)
    if (!adName.trim()) return false;

    return true;
  };

  const handleSave = () => {
    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
    const selectedAdset = adsets.find(a => a.id === selectedAdsetId);
    
    const data = {
      campaign: selectedCampaign ? selectedCampaign.name : "",
      campaignId: selectedCampaignId,
      adset: adsetMode === "createNew" ? adsetName : (selectedAdset ? selectedAdset.name : ""),
      adsetId: adsetMode === "selectExisting" ? selectedAdsetId : null,
      adsetMode: adsetMode,
      ad: adName, // Ad luôn được tạo mới
      adMode: "createNew", // Luôn là createNew
    };
    onSave?.(data);
    onClose?.();
  };

  const content = (
    <>
      {!isFullMode && (
        <div className="create-child-header">
          <div className="create-child-tabs">
            <button className="tab-button inactive">Tạo chiến dịch mới</button>
            <button className="tab-button active">Nhóm quảng cáo hoặc quảng cáo mới</button>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="create-child-content">
        {/* Campaign Section */}
        <div className="form-section-campaign">
          <div className="section-header-child">
            <div className="section-icon">
              <Folder size={16} />
            </div>
            <div className="section-label">Chiến dịch</div>
          </div>
          <div className="input-container">
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="form-input-child"
              disabled={loadingCampaigns || !selectedAccountId}
            >
              <option value="">
                {loadingCampaigns ? "Đang tải..." : !selectedAccountId ? "Chọn tài khoản quảng cáo" : " ~ Chọn chiến dịch ~"}
              </option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
            {selectedCampaignId && (
              <button 
                className="clear-button"
                onClick={() => setSelectedCampaignId("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Adset Section */}
        <div className="form-section-adset">
          <div className="section-header-child">
            <div className="section-icon">
              <Grid size={16} />
            </div>
            <div className="section-label">Nhóm quảng cáo</div>
          </div>
          <div className="form-row-child">
            <select 
              className="form-select-child"
              value={adsetMode}
              onChange={(e) => setAdsetMode(e.target.value)}
              disabled={!selectedCampaignId}
            >
              <option value="createNew">Tạo nhóm quảng cáo mới</option>
              <option value="selectExisting">Chọn từ nhóm có sẵn</option>
            </select>
            {adsetMode === "createNew" ? (
              <div className="input-container" style={{ flex: 1 }}>
                <input
                  type="text"
                  value={adsetName}
                  onChange={(e) => setAdsetName(e.target.value)}
                  className="form-input-child"
                  placeholder="Đặt tên cho nhóm quảng cáo này"
                  disabled={!selectedCampaignId}
                />
                {adsetName && (
                  <button 
                    className="clear-button"
                    onClick={() => setAdsetName("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="input-container" style={{ flex: 1 }}>
                <select
                  value={selectedAdsetId}
                  onChange={(e) => setSelectedAdsetId(e.target.value)}
                  className="form-input-child"
                  disabled={loadingAdsets || !selectedCampaignId}
                >
                  <option value="">
                    {loadingAdsets ? "Đang tải..." : !selectedCampaignId ? "Chọn chiến dịch trước" : " ~ Chọn nhóm quảng cáo ~"}
                  </option>
                  {adsets.map((adset) => (
                    <option key={adset.id} value={adset.id}>
                      {adset.name}
                    </option>
                  ))}
                </select>
                {selectedAdsetId && (
                  <button 
                    className="clear-button"
                    onClick={() => setSelectedAdsetId("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ad Section */}
        <div className="form-section-ad">
          <div className="section-header-child">
            <div className="section-icon">
              <FileText size={16} />
            </div>
            <div className="section-label">Quảng cáo</div>
          </div>
          <div className="input-container">
            <input
              type="text"
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              className="form-input-child"
              placeholder="Đặt tên cho quảng cáo này"
              disabled={(adsetMode === "selectExisting" && !selectedAdsetId) || (adsetMode === "createNew" && !adsetName)}
            />
            {adName && (
              <button 
                className="clear-button"
                onClick={() => setAdName("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="create-child-footer">
        <div className="spacer"></div>
        <button className="btn-secondary" onClick={onClose}>
          Hủy
        </button>
        <button 
          className="btn-primary" 
          onClick={handleSave}
          disabled={!isFormValid()}
        >
          Tiếp tục
        </button>
      </div>
    </>
  );

  if (isFullMode) {
    return (
      <div className="create-child-full-mode">
        {content}
      </div>
    );
  }

  return (
    <div className="create-child-overlay" onClick={onClose}>
      <div className="create-child-modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}

export default CreateChild;