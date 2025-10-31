import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, FileText, BarChart3, ChartLine } from 'lucide-react'
import './Sidebar.css'

function Sidebar() {
    const { t } = useTranslation()
    const [isHovered, setIsHovered] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    
    // Lấy route hiện tại từ location.pathname
    const getCurrentRoute = () => {
        const path = location.pathname
        if (path === '/') return 'home'
        return path.replace('/', '')
    }
    
    const currentRoute = getCurrentRoute()
    
    //Kiểm soát sự kiện di chuột vào Sidebar
    useEffect(() => {
        const cls = 'sidebar-collapsed'
        if (!isHovered) {
            document.body.classList.add(cls)
        } else {
            document.body.classList.remove(cls)
        }
        return () => document.body.classList.remove(cls)
    }, [isHovered])
    
    return (
        <aside 
            className={`app-sidebar ${!isHovered ? 'collapsed' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <nav className="sidebar-nav">
                <ul>
                    <li>
                        <button 
                            className={`sidebar-item ${currentRoute === 'account-management' ? 'active' : ''}`} 
                            onClick={() => navigate('/account-management')}
                        >
                            <span className="sidebar-icon"><FileText size={16} /></span>
                            <span className="sidebar-label">{t('sidebar.account')}</span>
                        </button>
                    </li>
                    <li>
                        <button 
                            className={`sidebar-item ${currentRoute === 'ads' ? 'active' : ''}`} 
                            onClick={() => navigate('/ads')}
                        >
                            <span className="sidebar-icon"><Plus size={16} /></span>
                            <span className="sidebar-label">{t('sidebar.ads_management')}</span>
                        </button>
                    </li>
                    <li>
                        <button 
                            className={`sidebar-item ${currentRoute === 'reports' ? 'active' : ''}`} 
                            onClick={() => navigate('/reports')}
                        >
                            <span className="sidebar-icon"><BarChart3 size={16} /></span>
                            <span className="sidebar-label">{t('sidebar.reports')}</span>
                        </button>
                    </li>
                    <li>
                        <button 
                            className={`sidebar-item ${currentRoute === 'stats' ? 'active' : ''}`} 
                            onClick={() => navigate('/stats')}
                        >
                            <span className="sidebar-icon"><ChartLine size={16} /></span>
                            <span className="sidebar-label">{t('sidebar.statistics')}</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </aside>
    )
}
export default Sidebar
