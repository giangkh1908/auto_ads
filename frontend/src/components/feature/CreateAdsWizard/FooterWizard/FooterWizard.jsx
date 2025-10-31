import React from "react";
import "./FooterWizard.css";
import { FB_OBJECTIVE_MAP } from "../../../../constants/wizardConstants";

function FooterWizard({
  wizardStep,
  setWizardStep,
  completedSteps,
  setCompletedSteps,
  campaign,
  adset,
  ad,
  campaignRef,
  adsetRef,
  adRef,
  loading,
  success,
  mode,
  onClose,
  handlePublish,
}) {
  return (
    <div className="ads-modal-footer">
      {wizardStep === 0 ? (
        <>
          <button className="btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <div className="spacer" />
          <button
            className="btn-primary"
            onClick={() => setWizardStep(1)}
            disabled={!Object.keys(FB_OBJECTIVE_MAP).includes(campaign.objective)}
          >
            Tiếp tục
          </button>
        </>
      ) : (
        <>
          <button className="btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <div className="spacer" />
          {wizardStep > 1 && (
            <button
              className="btn-secondary"
              onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}
            >
              Quay lại
            </button>
          )}

          {/* Đặt điều kiện để able button */}
          {wizardStep < 3 && (
            <button
              className="btn-primary"
              onClick={() =>
                setWizardStep((prev) => {
                  // Gate by validate of current step
                  if (prev === 1 && !(campaignRef.current?.validate?.() ?? true)) return prev;
                  if (prev === 2 && !(adsetRef.current?.validate?.() ?? true)) return prev;
                  if (prev >= 1 && prev <= 3 && !completedSteps[prev]) {
                    setCompletedSteps((cs) => ({ ...cs, [prev]: true }));
                  }
                  return Math.min(4, prev + 1);
                })
              }
              disabled={
                (wizardStep === 1 &&
                  (!campaign?.name || campaign.name.trim() === "")) ||
                (wizardStep === 2 &&
                  (!adset?.name || adset.name.trim() === "")) ||
                (wizardStep === 3 &&
                  (!ad?.name ||
                    ad.name.trim() === "" ||
                    !ad?.mediaUrl ||
                    !ad?.destinationUrl ||
                    String(ad.destinationUrl).trim() === ""))
              }
              title={
                wizardStep === 1
                  ? !campaign?.name || campaign.name.trim() === ""
                    ? "Vui lòng nhập tên chiến dịch"
                    : undefined
                  : wizardStep === 2
                  ? !adset?.name || adset.name.trim() === ""
                    ? "Vui lòng nhập tên nhóm quảng cáo"
                    : undefined
                  : undefined
              }
            >
              Tiếp tục
            </button>
          )}
          {wizardStep === 3 && (
            <button
              className="btn-primary"
              onClick={() => {
                if (!(adRef.current?.validate?.() ?? true)) return;
                if (!completedSteps[3]) {
                  setCompletedSteps((cs) => ({ ...cs, 3: true }));
                }
                setWizardStep(4);
              }}
              disabled={
                wizardStep === 3 &&
                (!ad?.name ||
                  ad.name.trim() === "" ||
                  !ad?.mediaUrl ||
                  !ad?.destinationUrl ||
                  String(ad.destinationUrl).trim() === "")
              }
              title={
                wizardStep === 3
                  ? !ad?.name ||
                    ad.name.trim() === "" ||
                    !ad?.mediaUrl ||
                    !ad?.destinationUrl ||
                    String(ad.destinationUrl).trim() === ""
                    ? "Vui lòng nhập tên quảng cáo, chọn file phương tiện và nhập URL đích"
                    : undefined
                  : undefined
              }
            >
              Xem trước
            </button>
          )}
          {wizardStep === 4 && (
            <>
              <button
                className="btn-post"
                onClick={handlePublish}
                disabled={loading}
              >
                {loading
                  ? "Đang xử lý..."
                  : success
                  ? "Thành công!"
                  : mode === "edit" && campaign?.status !== "DRAFT"
                  ? "Cập nhật"
                  : "Đăng quảng cáo"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default FooterWizard;
