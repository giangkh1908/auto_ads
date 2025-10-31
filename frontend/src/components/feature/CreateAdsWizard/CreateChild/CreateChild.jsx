import React, { useState } from "react";
import { Folder, Grid, FileText, X } from "lucide-react";
import "./CreateChild.css";

function CreateChild({ onClose, onSave, isFullMode = false }) {
  const [campaignName, setCampaignName] = useState("Test Khách hàng tiềm năng - Bản sao");
  const [adsetName, setAdsetName] = useState("");
  const [adName, setAdName] = useState("");

  const handleSave = () => {
    const data = {
      campaign: campaignName,
      adset: adsetName,
      ad: adName,
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
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="form-input-child"
              placeholder="Tên chiến dịch"
            />
            <button 
              className="clear-button"
              onClick={() => setCampaignName("")}
            >
              <X size={14} />
            </button>
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
            <select className="form-select-child">
              <option>Tạo nhóm quảng cáo mới</option>
              <option>Chọn từ nhóm có sẵn</option>
            </select>
            <input
              type="text"
              value={adsetName}
              onChange={(e) => setAdsetName(e.target.value)}
              className="form-input-child"
              placeholder="Đặt tên cho nhóm quảng cáo này"
            />
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
          <div className="form-row-child">
            <select className="form-select-child">
              <option>Tạo quảng cáo mới</option>
              <option>Chọn từ quảng cáo có sẵn</option>
            </select>
            <input
              type="text"
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              className="form-input-child"
              placeholder="Đặt tên cho quảng cáo này"
            />
          </div>
        </div>
      </div>

      <div className="create-child-footer">
        <div className="spacer"></div>
        <button className="btn-secondary" onClick={onClose}>
          Hủy
        </button>
        <button className="btn-primary" onClick={handleSave}>
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