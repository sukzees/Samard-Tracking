'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Language, translations } from '@/lib/translations';

import { safeStorage } from '@/lib/storage';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => translations.en[key] || key,
});

export const useLanguage = () => useContext(LanguageContext);

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const savedLang = safeStorage.getItem('language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'lo')) {
      setLanguageState(savedLang);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle('lo', language === 'lo');
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    safeStorage.setItem('language', lang);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
