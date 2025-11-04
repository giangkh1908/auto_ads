import { useTranslation } from "react-i18next";
import { NavLink, useParams } from "react-router-dom";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";

function History() {
  const { t } = useTranslation();
  const { shopId } = useParams(); // Thêm useParams để lấy shopId
  
  return (
    <div className="shop-border">
      <div className="shop-tabs">
        <NavLink 
          end 
          to={ROUTES.SHOP} 
          className={({isActive}) => `shop-tab ${isActive ? 'active' : ''}`}
        >
          {t('shop.my_shop')}
        </NavLink>
        <NavLink 
          to={shopId ? ROUTES.SHOP_EMPLOYEE.replace(':shopId', shopId) : ROUTES.SHOP} 
          className={({isActive}) => `shop-tab ${isActive ? 'active' : ''}`}
        >
          {t('shop.employee')}
        </NavLink>
        <NavLink 
          to={shopId ? ROUTES.SHOP_HISTORY.replace(':shopId', shopId) : ROUTES.SHOP} 
          className={({isActive}) => `shop-tab ${isActive ? 'active' : ''}`}
        >
          {t('shop.history')}
        </NavLink>
      </div>

      <div className="shop-page">
        <div className="shop-container">
          <div className="shop-content">
            <div className="placeholder-content">
              <p>{t('shop.history_content')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default History;


