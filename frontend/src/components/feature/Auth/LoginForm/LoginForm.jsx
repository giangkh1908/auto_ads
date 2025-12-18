import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Lock, Eye, EyeOff, Facebook } from "lucide-react";
import { useAuth } from "../../../../hooks/auth/useAuth";
import EmailVerification from "../EmailVerification/EmailVerification";
import AccountStatusError from "../AccountStatusError/AccountStatusError";
import axios from "axios";
import { toast } from "sonner";
import "./LoginForm.css";

function LoginForm({ onSuccess, onSwitchRegister, onSwitchReset }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [showAccountStatusError, setShowAccountStatusError] = useState(false);
  const [accountStatus, setAccountStatus] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [fbLoading, setFbLoading] = useState(false);

  const { login, loading, completeExternalLogin } = useAuth();

  // Facebook Business Login Configuration
  const FB_CONFIG_ID = import.meta.env.FB_CONFIG_ID;
  const API_BASE_URL = import.meta.env.VITE_API_URL; // Backend URL

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = t("validation.email_required");
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t("validation.email_invalid");
    }

    if (!password.trim()) {
      newErrors.password = t("validation.password_required");
    } else if (password.length < 6) {
      newErrors.password = t("validation.password_min_length");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateForm()) return;

    // Clear errors trước khi submit
    setErrors({});

    const result = await login({ email, password });

    if (result.success) {
      // Close modal after successful login (navigation handled by AuthContext)
      if (onSuccess) onSuccess();
    } else if (result.showAccountStatusError && result.status) {
      // Hiển thị AccountStatusError component cho inactive/banned accounts
      setAccountStatus(result.status);
      setShowAccountStatusError(true);
    } else if (result.requiresEmailVerification) {
      // Hiển thị form xác thực email
      setUserEmail(email);
      setShowVerificationForm(true);
    } else if (result.error) {
      // Hiển thị error message rõ ràng cho các lỗi khác (403, 401, etc.)
      const errorMessage = result.error || t("auth.login_failed");
      setErrors({ submit: errorMessage });
      // Toast đã được hiển thị trong AuthContext, nhưng cũng hiển thị trong form để rõ ràng hơn
      toast.error(errorMessage);
    }
  };

  const handleBackToLogin = () => {
    setShowVerificationForm(false);
    setShowAccountStatusError(false);
    setAccountStatus(null);
    setUserEmail("");
  };

  // Khởi tạo Facebook SDK
  useEffect(() => {
    const initFacebookSDK = () => {
      if (window.FB) return; // Đã được tải rồi

      window.fbAsyncInit = function () {
        window.FB.init({
          appId: "1445692036729400", // App ID từ Facebook Developer
          cookie: true,
          xfbml: true,
          version: "v23.0",
        });
        console.log("Facebook SDK initialized");
      };

      // Load Facebook SDK script
      (function (d, s, id) {
        var js,
          fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s);
        js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode.insertBefore(js, fjs);
      })(document, "script", "facebook-jssdk");
    };

    initFacebookSDK();
  }, []);

  // Facebook Business Login Handler
  const handleFacebookBusinessLogin = () => {
    setFbLoading(true);

    if (!window.FB) {
      toast.error(t("auth.facebook_sdk_error"));
      setFbLoading(false);
      return;
    }

    // Sử dụng FB.login với config_id cho Business Login
    window.FB.login(
      function (response) {
        console.log("Facebook Business Login Response:", response);

        if (response.status === "connected") {
          // Xử lý khi đăng nhập thành công
          handleFacebookLoginSuccess(response);
        } else {
          console.log("User cancelled login or did not fully authorize.");
          setFbLoading(false);
        }
      },
      {
        config_id: FB_CONFIG_ID, // Sử dụng configuration ID
        scope:
          "email,public_profile,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_manage_posts,business_management,ads_read,ads_management",
      }
    );
  };

  // Xử lý khi Facebook login thành công - thêm chi tiết logging
  const handleFacebookLoginSuccess = async (response) => {
    try {
      const { authResponse } = response;
      if (!authResponse?.accessToken) {
        toast.error(t("auth.login_failed"));
        return;
      }
      console.log("Facebook Auth Response:", authResponse);

      // 🔹 Gọi trực tiếp backend để BE xử lý tất cả (xác thực + lấy user info + pages)
      console.log("Calling backend API...");

      const loginResponse = await axios.post(
        `${API_BASE_URL}/api/auth/facebook`,
        {
          facebookId: authResponse.userID,
          accessToken: authResponse.accessToken,
        },
        {
          timeout: 15000,
          headers: { "Content-Type": "application/json" },
        }
      );

      console.log("Backend Response:", loginResponse.data);

      // 🔹 Xử lý kết quả trả về
      if (loginResponse.data.success) {
        const { user, tokens, pages } = loginResponse.data.data;

        console.log("Facebook Login Success!");

        // 🔹 Cập nhật AuthContext để đồng bộ UI
        // Await completeExternalLogin vì nó là async function
        const result = await completeExternalLogin({ user, tokens, pages });
        if (result?.success && onSuccess) {
          // Đóng popup sau khi login thành công
          onSuccess();
        }
      } else {
        // Kiểm tra xem có phải lỗi inactive/banned không
        const errorResponse = loginResponse.data;
        const errorCode = errorResponse?.error?.code;
        const status = errorResponse?.status;

        if (errorCode === "AUTH_010" || errorCode === "AUTH_011") {
          // Hiển thị AccountStatusError component
          setAccountStatus(status);
          setShowAccountStatusError(true);
          setFbLoading(false);
          return;
        }

        console.error("Backend login failed:", loginResponse.data);
        toast.error(
          errorResponse?.error?.message ||
            errorResponse?.message ||
            t("auth.login_failed")
        );
        setFbLoading(false);
      }
    } catch (error) {
      console.error("Backend login error:", error);

      // Kiểm tra xem có phải lỗi inactive/banned không
      const errorResponse = error.response?.data;
      const errorCode = errorResponse?.error?.code;
      const status = errorResponse?.status;

      if (errorCode === "AUTH_010" || errorCode === "AUTH_011") {
        // Hiển thị AccountStatusError component
        setAccountStatus(status);
        setShowAccountStatusError(true);
        setFbLoading(false);
        return;
      }

      if (error.code === "ECONNABORTED") {
        toast.error(t("errors.network_error"));
      } else if (error.response?.status === 500) {
        toast.error(t("errors.server_error"));
      } else {
        console.error("❌ Error response:", error.response?.data);
        toast.error(
          errorResponse?.error?.message ||
            errorResponse?.message ||
            t("common.error")
        );
      }
      setFbLoading(false);
    }
  };

  // Nếu đang hiển thị AccountStatusError
  if (showAccountStatusError && accountStatus) {
    return (
      <AccountStatusError status={accountStatus} onBack={handleBackToLogin} />
    );
  }

  // Nếu đang hiển thị form xác thực email
  if (showVerificationForm) {
    return (
      <EmailVerification
        email={userEmail}
        onBack={handleBackToLogin}
        title={t("auth.email_verification_title")}
      />
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <p className="text-classify">{t("auth.classify_customer")}</p>
      <button
        type="button"
        className="btn-fb"
        onClick={handleFacebookBusinessLogin}
        disabled={fbLoading}
      >
        <span className="fb-icon" aria-hidden="true">
          <Facebook size={16} />
        </span>
        {fbLoading ? t("auth.processing") : t("auth.login_with_facebook")}
      </button>

      <div className="form-sep">{t("auth.or")}</div>
      <p className="text-classify">{t("auth.classify_internal")}</p>
      <div className="input-group-auth">
        <div className="input-icon-auth">
          <Mail size={16} />
        </div>
        <input
          type="email"
          placeholder={t("auth.email_placeholder")}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
          }}
          className={errors.email ? "error" : ""}
        />
        {errors.email && <div className="error-message">{errors.email}</div>}
      </div>

      <div className="input-group-auth">
        <div className="input-icon-auth" aria-hidden="true">
          <Lock size={16} />
        </div>
        <input
          type={showPwd ? "text" : "password"}
          placeholder={t("auth.password_placeholder")}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password)
              setErrors((prev) => ({ ...prev, password: "" }));
          }}
          className={errors.password ? "error" : ""}
        />
        <div className="input-action" onClick={() => setShowPwd((v) => !v)}>
          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
        </div>
        {errors.password && (
          <div className="error-message">{errors.password}</div>
        )}
      </div>

      <button type="submit" className="btn-login-form" disabled={loading}>
        {loading ? t("auth.processing") : t("auth.login_button")}
      </button>

      {/* Hiển thị lỗi chung (403, 401, etc.) */}
      {errors.submit && (
        <div
          className="error-message"
          style={{ marginTop: "10px", textAlign: "center" }}
        >
          {errors.submit}
        </div>
      )}

      <div className="form-switch">
        {t("auth.no_account")}{" "}
        <span className="link" onClick={onSwitchRegister}>
          {t("auth.register_now")}
        </span>
        <br />
        <span className="link" onClick={onSwitchReset}>
          {t("auth.forgot_password")}
        </span>
      </div>
    </form>
  );
}

export default LoginForm;
