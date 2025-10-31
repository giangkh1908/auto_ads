import { useTranslation } from 'react-i18next'
import './NotFound.css'

function NotFound (){
    const { t } = useTranslation()
    
    return (
        <>
            <div className = "notfound-title">
                <h1>{t('errors.404_code')}</h1>
            </div>
        </>
    );
}
export default NotFound