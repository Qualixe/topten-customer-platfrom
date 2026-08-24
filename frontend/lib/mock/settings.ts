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

export interface BirthdaySettings {
  notifyDaysBefore: number;
  autoSendMessage: boolean;
  messageTemplate: string;
  autoAssignGift: boolean;
}

export interface VipSettings {
  vipSpendingThreshold: number;
  platinumThreshold: number;
  goldThreshold: number;
  autoUpgradeCustomers: boolean;
}

export interface NotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  defaultSenderName: string;
  respectQuietHours: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface CourierSettings {
  defaultCourier: string;
  autoAssignCourier: boolean;
  deliverySlaDays: number;
  packagingNotes: string;
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

export const defaultBirthdaySettings: BirthdaySettings = {
  notifyDaysBefore: 3,
  autoSendMessage: true,
  messageTemplate:
    "Happy Birthday, {{name}}! Enjoy a special gift from all of us at TopTen.",
  autoAssignGift: true,
};

export const defaultVipSettings: VipSettings = {
  vipSpendingThreshold: 50000,
  platinumThreshold: 150000,
  goldThreshold: 80000,
  autoUpgradeCustomers: false,
};

export const defaultNotificationSettings: NotificationSettings = {
  smsEnabled: true,
  emailEnabled: true,
  whatsappEnabled: false,
  defaultSenderName: "TopTen Supermarket",
  respectQuietHours: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

export const defaultCourierSettings: CourierSettings = {
  defaultCourier: "Pathao",
  autoAssignCourier: true,
  deliverySlaDays: 3,
  packagingNotes: "Include a printed thank-you card with every gift order.",
};

export const defaultAccountSettings: AccountSettings = {
  fullName: "Store Admin",
  email: "admin@topten.com.bd",
  phone: "+8801711000000",
  role: "Administrator",
  twoFactorEnabled: false,
};
