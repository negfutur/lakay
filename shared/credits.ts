export type CreditPackage = {
  id: string;
  label: string;
  stripePriceId: string;
  credits: number;
};

export type CreditBalance = {
  userId: number;
  balance: number;
};
