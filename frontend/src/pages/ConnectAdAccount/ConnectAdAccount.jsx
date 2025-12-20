import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './ConnectAdAccount.css'
import { useToast } from '../../hooks/common/useToast'
import { useAuth } from '../../hooks/auth/useAuth'
import axiosInstance from '../../utils/api/axios'
import logo from "../../assets/Logo_Fchat.png";

function ConnectAdAccount() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [fbAdAccounts, setFbAdAccounts] = useState([])
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('status')
  const [selectAll, setSelectAll] = useState(false)

  const FB_CONFIG_ID = import.meta.env.FB_CONFIG_ID
  const hasFacebookConnected = !!user?.facebookId

  // Tải dữ liệu tài khoản quảng cáo từ Facebook API
  useEffect(() => {
    const loadAdAccounts = async () => {
      try {
        setLoading(true)

        // Lấy danh sách tài khoản quảng cáo trực tiếp từ Facebook (đã có thông tin connected_shop và can_connect)
        const fbRes = await axiosInstance.get('/api/ads-accounts/facebook')
        const fbAccounts = fbRes.data?.items || []
        setFbAdAccounts(fbAccounts)
      } catch (e) {
        console.error('Load ad accounts error:', e)
        toast.error(t('connect_ad_account.load_error'))
      } finally {
        setLoading(false)
      }
    }
    loadAdAccounts()
  }, [toast, t])

  // Chuẩn hóa dữ liệu tài khoản quảng cáo từ API
  const adAccounts = useMemo(() => {
    const getStatusLabel = (accountStatus) => {
      const status = Number(accountStatus)
      switch (status) {
        case 1: return t('account_management.status_active')
        case 2: return t('account_management.status_disabled')
        case 3: return t('account_management.status_unverified')
        default: return t('account_management.status_inactive')
      }
    }

    return (fbAdAccounts || []).map(acc => {
      const isConnectedToCurrentShop = acc.connected_shop?.is_current_shop || false
      const isConnectedToOtherShop = acc.connected_shop && !acc.connected_shop.is_current_shop

      return {
        id: acc.external_id || acc._id,
        name: acc.name || t('connect_ad_account.default_account_name'),
        externalId: acc.external_id,
        currency: acc.currency || 'USD',
        timezone: acc.timezone_name || 'UTC',
        status: getStatusLabel(acc.account_status),
        isConnected: isConnectedToCurrentShop || isConnectedToOtherShop,
        isConnectedToCurrentShop,
        isConnectedToOtherShop,
        canConnect: acc.can_connect !== false, // Mặc định true nếu không có thông tin
        connectedBy: acc.connected_shop?.shop_name || null,
        isSelected: false,
        avatar: user?.avatar || `https://graph.facebook.com/${acc.external_id}/picture?type=square`,
      }
    })
  }, [fbAdAccounts, t, user])

  //Đếm số tài khoản đã kết nối và còn lại
  const connectedCount = adAccounts.filter(acc => acc.isConnectedToCurrentShop).length
  const remainingCount = adAccounts.length - connectedCount

  // Loại bỏ các tài khoản đã kết nối (với shop hiện tại hoặc shop khác) hoặc không thể kết nối khỏi selectedAccounts
  useEffect(() => {
    setSelectedAccounts(prev =>
      prev.filter(accountId => {
        const account = adAccounts.find(acc => acc.id === accountId)
        return account && !account.isConnectedToCurrentShop && !account.isConnectedToOtherShop && account.canConnect
      })
    )
  }, [adAccounts])

  //Xử lý chọn tài khoản quảng cáo
  const handleAccountSelect = (accountId) => {
    const account = adAccounts.find(acc => acc.id === accountId)
    // Không cho phép chọn tài khoản:
    // - Đã kết nối với shop hiện tại
    // - Đã kết nối với shop khác (không phải current shop)
    // - Không thể kết nối (canConnect = false)
    if (account && (
      account.isConnectedToCurrentShop ||
      account.isConnectedToOtherShop ||
      !account.canConnect
    )) {
      return
    }
    //Thêm tài khoản vào selectedAccounts
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }

  //Xử lý chọn tất cả
  const handleSelectAll = () => {
    const selectableAccounts = filteredAccounts.filter(
      acc => !acc.isConnectedToCurrentShop && !acc.isConnectedToOtherShop && acc.canConnect
    )

    if (selectAll) {
      // Bỏ chọn tất cả
      setSelectedAccounts([])
    } else {
      // Chọn tất cả các tài khoản có thể chọn được
      setSelectedAccounts(selectableAccounts.map(acc => acc.id))
    }
  }

  //Xử lý kết nối các tài khoản quảng cáo đã chọn
  const handleConnectSelected = async () => {
    const selected = adAccounts.filter(acc => selectedAccounts.includes(acc.id))
    if (selected.length === 0) return

    try {
      setSyncing(true)
      // Chỉ khi bấm kết nối mới lưu tài khoản vào DB
      for (const acc of selected) {
        await axiosInstance.post('/api/ads-accounts/connect', { account_id: acc.externalId })
      }
      // Reload danh sách để cập nhật trạng thái
      const fbRes = await axiosInstance.get('/api/ads-accounts/facebook')
      const fbAccounts = fbRes.data?.items || []
      setFbAdAccounts(fbAccounts)
      toast.success(t('connect_ad_account.connect_success', { count: selected.length }))
      navigate('/account-management')
    } catch (e) {
      console.error('Connect ad account error:', e)
      toast.error(t('connect_ad_account.connect_error'))
    } finally {
      setSyncing(false)
    }
  }

  //Xử lý làm mới kết nối
  const handleRefresh = async () => {
    // Nếu user chưa có Facebook → gọi login Facebook
    if (!hasFacebookConnected) {
      handleFacebookBusinessLogin()
      return
    }

    // Nếu đã có Facebook → refresh như bình thường
    try {
      setSyncing(true)
      const fbRes = await axiosInstance.get('/api/ads-accounts/facebook')
      const fbAccounts = fbRes.data?.items || []
      setFbAdAccounts(fbAccounts)
      toast.success(t('connect_ad_account.refresh_success'))
    } catch (error) {
      // console.log('Refresh ad accounts error:', error)
      toast.error(t('connect_ad_account.refresh_error', { error: error.message || 'Unknown error' }))
    } finally {
      setSyncing(false)
    }
  }

  // Facebook Business Login Handler
  const handleFacebookBusinessLogin = () => {
    if (!window.FB) {
      toast.error("Facebook SDK chưa sẵn sàng. Vui lòng thử lại.")
      return
    }

    window.FB.login(
      function (response) {
        if (response.status === "connected") {
          handleFacebookLoginSuccess(response)
        }
      },
      {
        config_id: FB_CONFIG_ID,
        scope: "email,public_profile,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_manage_posts,business_management,ads_read,ads_management",
      }
    )
  }

  // Xử lý khi Facebook login thành công - LINK Facebook vào account hiện tại
  const handleFacebookLoginSuccess = async (response) => {
    try {
      setSyncing(true)
      const { authResponse } = response
      if (!authResponse?.accessToken) {
        toast.error("Đăng nhập Facebook thất bại")
        setSyncing(false)
        return
      }

      // Gọi endpoint LINK thay vì LOGIN
      const linkResponse = await axiosInstance.post(
        "/api/auth/facebook/link",
        {
          facebookId: authResponse.userID,
          accessToken: authResponse.accessToken,
        }
      )

      if (linkResponse.data.success) {
        const { user: updatedUser } = linkResponse.data.data
        
        // Cập nhật user trong context
        updateUser(updatedUser)
        
        // Reload danh sách ad accounts
        const fbRes = await axiosInstance.get('/api/ads-accounts/facebook')
        const fbAccounts = fbRes.data?.items || []
        setFbAdAccounts(fbAccounts)
        toast.success("Kết nối Facebook thành công!")
      } else {
        const errorCode = linkResponse.data?.error?.code
        
        if (errorCode === "FACEBOOK_ALREADY_BOUND") {
          toast.error("Tài khoản Facebook này đã được liên kết với tài khoản khác. Vui lòng sử dụng tài khoản Facebook khác.")
        } else {
          toast.error(linkResponse.data?.error?.message || "Liên kết thất bại")
        }
      }
    } catch (error) {
      console.error("Facebook link error:", error)
      const errorCode = error.response?.data?.error?.code
      
      if (errorCode === "FACEBOOK_ALREADY_BOUND") {
        toast.error("Tài khoản Facebook này đã được liên kết với tài khoản khác. Vui lòng sử dụng tài khoản Facebook khác.")
      } else {
        toast.error(error.response?.data?.error?.message || "Liên kết thất bại")
      }
    } finally {
      setSyncing(false)
    }
  }

  // Khởi tạo Facebook SDK
  useEffect(() => {
    if (window.FB) return

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: "1445692036729400",
        cookie: true,
        xfbml: true,
        version: "v23.0",
      })
    }

    ;(function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0]
      if (d.getElementById(id)) return
      js = d.createElement(s)
      js.id = id
      js.src = "https://connect.facebook.net/en_US/sdk.js"
      fjs.parentNode.insertBefore(js, fjs)
    })(document, "script", "facebook-jssdk")
  }, [])

  //Xử lý quay lại danh sách tài khoản Quảng cáo
  const handleBackToList = () => {
    navigate(-1)
  }

  //Lọc danh sách tài khoản quảng cáo theo tên và trạng thái
  const filteredAccounts = adAccounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.externalId.toLowerCase().includes(searchTerm.toLowerCase())
    const isConnectedToCurrent = account.isConnectedToCurrentShop
    const matchesStatus = statusFilter === 'status' ||
      (statusFilter === 'connected' && isConnectedToCurrent) ||
      (statusFilter === 'not-connected' && !isConnectedToCurrent && !account.isConnectedToOtherShop)
    return matchesSearch && matchesStatus
  })

  // Cập nhật trạng thái selectAll khi selectedAccounts thay đổi
  useEffect(() => {
    const selectableAccounts = filteredAccounts.filter(
      account => !account.isConnectedToCurrentShop && !account.isConnectedToOtherShop && account.canConnect
    )
    setSelectAll(selectableAccounts.length > 0 && selectedAccounts.length === selectableAccounts.length)
  }, [selectedAccounts, filteredAccounts])

  return (
    <div className="connect-page">
      <div className="connect-container">
        {/* Logo */}
        <div className="logo-section">
          <div className="logo">
            <img className="logo-img" src={logo}></img>
          </div>
        </div>

        {/* Status Info */}
        <div className="status-info">
          {t('connect_ad_account.connected_count', { count: connectedCount, remaining: remainingCount })}
        </div>

        {/* Ad Account Management Section */}
        <div className="page-management-container">
          {loading ? (
            <div className="empty-state">
              <p>{t('connect_ad_account.loading_list')}</p>
            </div>
          ) : adAccounts.length === 0 ? (
            <div className="empty-state">
              <p>{t('connect_ad_account.no_accounts')}</p>
            </div>
          ) : (
            <>
              {/* Search and Filter Bar */}
              <div className="search-filter-bar">
                <div className="search-section">
                  <input
                    type="text"
                    className="search-input"
                    placeholder={t('connect_ad_account.search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {/* Filter Section */}
                <div className="filter-section-connect-account">
                  <select
                    className="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="status">{t('connect_ad_account.status_filter')}</option>
                    <option value="connected">{t('connect_ad_account.status_connected')}</option>
                    <option value="not-connected">{t('connect_ad_account.status_not_connected')}</option>
                  </select>
                  <span className="page-count">{t('connect_ad_account.account_count', { count: filteredAccounts.length })}</span>
                </div>
              </div>

              {/* Ad Account List Table */}
              <div className="page-list-table">
                <div className="table-header">
                  <div className="col-page-name">{t('connect_ad_account.table_account_name')}</div>
                  <div className="col-role">{t('connect_ad_account.table_status')}</div>
                  <div className="col-status">{t('connect_ad_account.table_connection')}</div>
                  <div className="col-select">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="select-all-checkbox"
                      disabled={
                        // Disable khi không còn tài khoản nào có thể chọn (chưa kết nối và có thể connect)
                        filteredAccounts.filter(
                          account => !account.isConnectedToCurrentShop && !account.isConnectedToOtherShop && account.canConnect
                        ).length === 0
                      }
                    />
                    {/* <span className="select-all-label">Chọn tất cả</span> */}
                  </div>
                </div>

                {filteredAccounts.map((account) => (
                  <div key={account.id} className="table-row">
                    <div className="col-page-name">
                      <div className="page-info">
                        <img
                          src={account.avatar}
                          alt="Avatar"
                          className="page-avatar"
                        />
                        <div className="page-details">
                          <div className="page-name">
                            {account.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {account.externalId}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-role">
                      <span className="role-badge">{account.status}</span>
                    </div>
                    <div className="col-status">
                      <div className="status-info">
                        <div className="status-text">
                          {account.isConnectedToCurrentShop
                            ? t('connect_ad_account.connected')
                            : account.isConnectedToOtherShop
                              ? `Đã kết nối với shop "${account.connectedBy}"`
                              : t('connect_ad_account.not_connected')}
                        </div>
                        {account.connectedBy && (
                          <div className="connected-by">{account.connectedBy}</div>
                        )}
                      </div>
                    </div>

                    <div className="col-select">
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account.id)}
                        onChange={() => handleAccountSelect(account.id)}
                        className="page-checkbox"
                        disabled={account.isConnectedToCurrentShop || account.isConnectedToOtherShop || !account.canConnect}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Connect Button Bottom */}
              <div className="connect-bottom">
                <button
                  className="connect-selected-btn"
                  onClick={handleConnectSelected}
                  disabled={selectedAccounts.length === 0 || syncing}
                >
                  {syncing ? t('connect_ad_account.connecting') : t('connect_ad_account.connect_count', { count: selectedAccounts.length })}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Help Section */}
        <div className="help-section">
          <h3 className="help-title">{t('connect_ad_account.help_title')}</h3>
          <p className="help-text">
            {t('connect_ad_account.help_description')}
          </p>
          <button className="refresh-btn" onClick={handleRefresh} disabled={syncing}>
            <span className="refresh-icon">↻</span>
            {syncing ? t('connect_ad_account.refreshing') : t('connect_ad_account.refresh_list')}
          </button>
        </div>

        {/* Contact Info
        <div className="contact-info">
          <p className="permission-text">
            Chúng tôi sẽ cần quyền ADMIN các Fanpages của bạn để kết nối với Chatbot.
          </p>
          <p className="contact-text">
            Mọi thắc mắc vui lòng liên hệ <strong>0898 986 008</strong> hoặc tham gia nhóm hỗ trợ <strong>Group Fchat</strong>
          </p>
        </div> */}

        {/* Back Button */}
        <div className="back-section">
          <button className="back-btn" onClick={handleBackToList}>
            <span className="back-icon">←</span>
            {t('connect_ad_account.back_button')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConnectAdAccount
