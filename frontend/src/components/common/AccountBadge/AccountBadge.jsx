import { useEffect, useState } from 'react'
import './AccountBadge.css'

/**
 * Component hiển thị account đang được chọn
 */
function AccountBadge() {
  const [accountName, setAccountName] = useState(null)

  useEffect(() => {
    const storedAccountId = localStorage.getItem('selected_account_id')
    const storedAccountName = localStorage.getItem('selected_account_name')
    
    if (storedAccountId && storedAccountName) {
      setAccountName(storedAccountName)
    }
  }, [])

  if (!accountName) return null

  return (
    <div className="account-badge">
      <span className="account-badge-icon">📊</span>
      <span className="account-badge-text">{accountName}</span>
    </div>
  )
}

export default AccountBadge
