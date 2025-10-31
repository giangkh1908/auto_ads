import { useEffect, useRef, useState } from 'react'

function AdsDropdown({ 
    onCopy, 
    onDelete, 
    onCreateAdset, 
    onCreateAd, 
    menuAlign = 'right', 
    triggerClassName = '',
    isOpen = false,
    onClose
}) {
    const [open, setOpen] = useState(isOpen)
    const menuRef = useRef(null)

    // Sync với prop isOpen từ parent
    useEffect(() => {
        setOpen(isOpen)
    }, [isOpen])

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpen(false)
                onClose?.()
            }
        }
        if (open) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open, onClose])

    //  Xác định "type" tự động
    const type = onCreateAdset ? 'campaign' : onCreateAd ? 'adset' : 'ad'

    return (
        <div className="hierarchy-ads-dropdown" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                className={`actions-trigger ${open ? 'open' : ''} ${triggerClassName}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
            >
                ⋮
            </button>

            {open && (
                <div
                    className="actions-menu"
                    role="menu"
                    style={{
                        right: menuAlign === 'right' ? 0 : 'auto',
                        left: menuAlign === 'left' ? 0 : 'auto'
                    }}
                >
                    {/* Mục chung cho tất cả */}
                    <button className="actions-menu-item" onClick={() => { onCopy?.(); setOpen(false); onClose?.() }}>Sao chép</button>
                    <button className="actions-menu-item" onClick={() => { onDelete?.(); setOpen(false); onClose?.() }}>Xóa</button>

                    {/* Mục riêng */}
                    {type === 'campaign' && (
                        <button className="actions-menu-item" onClick={() => { onCreateAdset?.(); setOpen(false); onClose?.() }}>
                            Tạo nhóm quảng cáo
                        </button>
                    )}
                    {type === 'adset' && (
                        <button className="actions-menu-item" onClick={() => { onCreateAd?.(); setOpen(false); onClose?.() }}>
                            Tạo quảng cáo
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default AdsDropdown
