export type CountryCode = 'KE' | 'UG' | 'TZ' | 'GH' | 'NG' | 'ZA' | 'ZM' | 'BJ';

export interface Country {
  code: CountryCode;
  name: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  phone_prefix: string;
}

export interface PaymentGateway {
  code: string;
  name: string;
  type: 'mobile_money' | 'bank' | 'wallet' | 'ussd' | 'fintech';
  fields: Record<string, string>;
}

export const AFRICAN_COUNTRIES: Record<CountryCode, Country> = {
  KE: {
    code: 'KE',
    name: 'Kenya',
    currency_code: 'KES',
    currency_name: 'Kenyan Shilling',
    currency_symbol: 'KSh',
    phone_prefix: '+254',
  },
  UG: {
    code: 'UG',
    name: 'Uganda',
    currency_code: 'UGX',
    currency_name: 'Ugandan Shilling',
    currency_symbol: 'USh',
    phone_prefix: '+256',
  },
  TZ: {
    code: 'TZ',
    name: 'Tanzania',
    currency_code: 'TZS',
    currency_name: 'Tanzanian Shilling',
    currency_symbol: 'TSh',
    phone_prefix: '+255',
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    currency_code: 'GHS',
    currency_name: 'Ghanaian Cedi',
    currency_symbol: 'GH₵',
    phone_prefix: '+233',
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    currency_code: 'NGN',
    currency_name: 'Nigerian Naira',
    currency_symbol: '₦',
    phone_prefix: '+234',
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    currency_code: 'ZAR',
    currency_name: 'South African Rand',
    currency_symbol: 'R',
    phone_prefix: '+27',
  },
  ZM: {
    code: 'ZM',
    name: 'Zambia',
    currency_code: 'ZMW',
    currency_name: 'Zambian Kwacha',
    currency_symbol: 'ZK',
    phone_prefix: '+260',
  },
  BJ: {
    code: 'BJ',
    name: 'Benin',
    currency_code: 'XOF',
    currency_name: 'West African CFA Franc',
    currency_symbol: 'CFA',
    phone_prefix: '+229',
  },
};

export const PAYMENT_GATEWAYS_BY_COUNTRY: Record<CountryCode, PaymentGateway[]> = {
  KE: [
    {
      code: 'mpesa_personal',
      name: 'M-Pesa',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'mpesa_paybill',
      name: 'M-Pesa Paybill',
      type: 'mobile_money',
      fields: { paybill: 'Paybill Number', account: 'Account Number' },
    },
    {
      code: 'airtel_money',
      name: 'Airtel Money',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'bank_transfer',
      name: 'Bank Transfer',
      type: 'bank',
      fields: { bank: 'Bank Name', account: 'Account Number', name: 'Account Name' },
    },
  ],
  NG: [
    {
      code: 'bank_transfer_ng',
      name: 'Bank Transfer',
      type: 'bank',
      fields: { bank: 'Bank Name', account: 'Account Number', name: 'Account Name' },
    },
    {
      code: 'opay',
      name: 'Opay',
      type: 'fintech',
      fields: { phone: 'Phone Number/Account', name: 'Full Name' },
    },
    {
      code: 'palmpay',
      name: 'PalmPay',
      type: 'fintech',
      fields: { phone: 'Phone Number/Account', name: 'Full Name' },
    },
    {
      code: 'moniepoint',
      name: 'Moniepoint',
      type: 'fintech',
      fields: { account: 'Account Number', name: 'Business/Account Name' },
    },
  ],
  GH: [
    {
      code: 'mtn_mobile_money',
      name: 'MTN Mobile Money',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'vodafone_cash',
      name: 'Vodafone Cash',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'airteltigo',
      name: 'AirtelTigo',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
  ],
  UG: [
    {
      code: 'mtn_uganda',
      name: 'MTN Uganda',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'airtel_money_ug',
      name: 'Airtel Money',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'bank_transfer_ug',
      name: 'Bank Transfer',
      type: 'bank',
      fields: { bank: 'Bank Name', account: 'Account Number', name: 'Account Name' },
    },
  ],
  TZ: [
    {
      code: 'tigo_pesa',
      name: 'Tigo Pesa',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'mpesa_tanzania',
      name: 'M-Pesa Tanzania',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'airtel_money_tz',
      name: 'Airtel Money',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
  ],
  ZA: [
    {
      code: 'bank_transfer_za',
      name: 'Bank Transfer',
      type: 'bank',
      fields: { bank: 'Bank Name', account: 'Account Number', name: 'Account Name' },
    },
    {
      code: 'ozow',
      name: 'Ozow',
      type: 'fintech',
      fields: { email: 'Registered Email', name: 'Full Name' },
    },
    {
      code: 'payfast',
      name: 'PayFast',
      type: 'fintech',
      fields: { email: 'Registered Email', name: 'Full Name' },
    },
  ],
  ZM: [
    {
      code: 'mtn_zambia',
      name: 'MTN Zambia',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'airtel_money_zm',
      name: 'Airtel Money Zambia',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
  ],
  BJ: [
    {
      code: 'mtn_benin',
      name: 'MTN Benin',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
    {
      code: 'moov_money',
      name: 'Moov Money',
      type: 'mobile_money',
      fields: { phone: 'Phone Number', name: 'Full Name' },
    },
  ],
};

export const getCountryList = (): Country[] => {
  return Object.values(AFRICAN_COUNTRIES);
};

export const getCountryByCode = (code: CountryCode): Country | undefined => {
  return AFRICAN_COUNTRIES[code];
};

export const getPaymentGatewaysByCountry = (code: CountryCode): PaymentGateway[] => {
  return PAYMENT_GATEWAYS_BY_COUNTRY[code] || [];
};
