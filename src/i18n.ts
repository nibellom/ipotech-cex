import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './translations/ru.json';
import en from './translations/en.json';

// Получаем сохраненный язык из localStorage или используем 'ru' по умолчанию
const savedLanguage = localStorage.getItem('i18nextLng') || 'ru';

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ru: { translation: ru } },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

// Сохраняем язык при изменении
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18nextLng', lng);
});

export default i18n;
