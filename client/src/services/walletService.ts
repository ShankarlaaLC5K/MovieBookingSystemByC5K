import api from "./api";

export interface WalletTransaction {
  _id: string;
  booking:
    | string
    | {
        _id: string;
        bookingReference?: string;
        status?: string;
      };
  type: "reschedule_refund" | "cancellation_refund";
  amount: number;
  description: string;
  reference: string;
  createdAt: string;
}

export interface WalletResponse {
  success: boolean;
  walletBalance: number;
  transactions: WalletTransaction[];
}

export async function getWallet(): Promise<WalletResponse> {
  const response = await api.get<WalletResponse>("/wallet");
  return response.data;
}