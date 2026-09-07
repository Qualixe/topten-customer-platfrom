export interface GeneralSettings {
  storeName: string;
  supportEmail: string;
  maintenanceMode: boolean;
}

export interface CustomerSettings {
  customerIdPrefix: string;
  defaultStatus: string;
  minAgeRequirement: number;
  allowDuplicateEmails: boolean;
}

export interface VipSettings {
  vipSpendingThreshold: number;
  platinumThreshold: number;
  goldThreshold: number;
  autoUpgradeCustomers: boolean;
}

export interface AccountSettings {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  twoFactorEnabled: boolean;
}

export const defaultGeneralSettings: GeneralSettings = {
  storeName: "TopTen Supermarket",
  supportEmail: "support@topten.com.bd",
  maintenanceMode: false,
};

export const defaultCustomerSettings: CustomerSettings = {
  customerIdPrefix: "TT-CUST",
  defaultStatus: "Active",
  minAgeRequirement: 13,
  allowDuplicateEmails: false,
};

export const defaultVipSettings: VipSettings = {
  vipSpendingThreshold: 50000,
  platinumThreshold: 150000,
  goldThreshold: 80000,
  autoUpgradeCustomers: false,
};

export const defaultAccountSettings: AccountSettings = {
  fullName: "Store Admin",
  email: "admin@topten.com.bd",
  phone: "+8801711000000",
  role: "Administrator",
  twoFactorEnabled: false,
};
