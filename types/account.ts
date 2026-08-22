import type { CustomerOrder } from "@/types";

export type CustomerProfileView = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  membershipNumber: string;
  emailVerifiedAt: string | null;
  marketingOptIn: boolean;
  memberSince: string;
};

export type LoyaltyProgressView = {
  ruleId: string;
  name: string;
  description: string;
  triggerProductId: string;
  triggerProductName: string;
  requiredQuantity: number;
  unitsEarned: number;
  currentUnits: number;
  rewardType: "free_product" | "physical_gift";
  rewardName: string;
  reviewRequired: boolean;
};

export type LoyaltyRewardView = {
  id: string;
  code: string;
  ruleId: string;
  type: "free_product" | "physical_gift";
  productId: string | null;
  name: string;
  status: "issued" | "reserved" | "redeemed" | "revoked" | "expired";
  issuedAt: string;
  expiresAt: string | null;
  redeemedAt: string | null;
};

export type AccountGiftCardView = {
  id: string;
  lastFour: string;
  initialBalance: number;
  balance: number;
  status: "active" | "disabled" | "redeemed" | "expired";
  recipientName: string;
  recipientEmail: string;
  createdAt: string;
};

export type CustomerAccountData = {
  profile: CustomerProfileView;
  orders: CustomerOrder[];
  loyalty: LoyaltyProgressView[];
  rewards: LoyaltyRewardView[];
  giftCards: AccountGiftCardView[];
};

