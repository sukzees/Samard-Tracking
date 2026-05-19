'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { safeStorage } from '@/lib/storage';

export type Currency = 'USD' | 'LAK' | 'THB';

export interface ExchangeRates {
  USD: number;
  LAK: number;
  THB: number;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  rates: ExchangeRates;
  setRates: (rates: ExchangeRates) => void;
  formatAmount: (amount: number, curr?: Currency) => string;
  convertAmount: (amount: number, from: Currency, to: Currency) => number;
}

const defaultRates: ExchangeRates = {
  USD: 1,
  LAK: 21000,
  THB: 35,
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  setCurrency: () => {},
  rates: defaultRates,
  setRates: () => {},
  formatAmount: (amount) => String(amount),
  convertAmount: (amount) => amount,
});

export const useCurrency = () => useContext(CurrencyContext);

export default function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('USD');
  const [rates, setRatesState] = useState<ExchangeRates>(defaultRates);

  useEffect(() => {
    const savedCurrency = safeStorage.getItem('currency') as Currency;
    if (savedCurrency && (savedCurrency === 'USD' || savedCurrency === 'LAK' || savedCurrency === 'THB')) {
      setCurrencyState(savedCurrency);
    }

    const savedRates = safeStorage.getItem('exchange_rates');
    if (savedRates) {
      try {
        setRatesState(JSON.parse(savedRates));
      } catch (e) {
        console.error("Failed to parse saved rates", e);
      }
    }
  }, []);

  const setCurrency = (curr: Currency) => {
    setCurrencyState(curr);
    safeStorage.setItem('currency', curr);
  };

  const setRates = (newRates: ExchangeRates) => {
    setRatesState(newRates);
    safeStorage.setItem('exchange_rates', JSON.stringify(newRates));
  };

  const convertAmount = (amount: number, from: Currency, to: Currency) => {
    if (from === to) return amount;
    // Convert to USD first (base)
    const inUSD = amount / rates[from];
    // Convert to target
    return inUSD * rates[to];
  };

  const formatAmount = (amount: number, curr?: Currency) => {
    const activeCurrency = curr || currency;
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: activeCurrency === 'LAK' ? 0 : 2,
    });
    
    // Custom formatting for LAK since Intl might not be perfect for it in all envs
    if (activeCurrency === 'LAK') {
      return `${amount.toLocaleString('en-US')} ₭`;
    }
    
    return formatter.format(amount);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, setRates, formatAmount, convertAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}
