import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation('wizard');

  return (
    <div className="ads-modal-footer">
      {wizardStep === 0 ? (
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('footer.cancel')}
          </button>
          <div className="spacer" />
          <button
            className="btn-primary"
            onClick={() => setWizardStep(1)}
            disabled={!Object.keys(FB_OBJECTIVE_MAP).includes(campaign.objective)}
          >
            {t('footer.continue')}
          </button>
        </>
      ) : (
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('footer.close')}
          </button>
          <div className="spacer" />
          {wizardStep > 1 && (
            <button
              className="btn-secondary"
              onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}
            >
              {t('footer.back')}
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
                    ? t('footer.enter_campaign_name')
                    : undefined
                  : wizardStep === 2
                    ? !adset?.name || adset.name.trim() === ""
                      ? t('footer.enter_adset_name')
                      : undefined
                    : undefined
              }
            >
              {t('footer.continue')}
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
                    ? t('footer.enter_ad_details')
                    : undefined
                  : undefined
              }
            >
              {t('footer.preview')}
            </button>
          )}
          {wizardStep === 4 && (
            <>
              {!(campaign?.status === "ARCHIVED" || adset?.status === "ARCHIVED" || ad?.status === "ARCHIVED") && (
                <button
                  className="btn-post"
                  onClick={handlePublish}
                  disabled={loading}
                >
                  {loading
                    ? t('footer.processing')
                    : success
                      ? t('footer.success')
                      : mode === "edit" && campaign?.status !== "DRAFT"
                        ? t('footer.update')
                        : t('footer.publish')}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default FooterWizard;
