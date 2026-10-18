import api from "./api";

export interface CreatePaymentOrderResponse {
  success: boolean;
  message: string;
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  payment: {
    _id: string;
    booking: string;
    amount: number;
    provider: string;
    gatewayOrderId: string;
    status: string;
    walletAmount?: number;
  };
  keyId: string;
}

export interface CreateReschedulePaymentOrderResponse {
  success: boolean;
  message: string;
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  payment: {
    _id: string;
    booking: string;
    amount: number;
    provider: string;
    gatewayOrderId: string;
    status: string;
  };
  keyId: string;
  difference: number;
  targetTotalAmount: number;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  booking: {
    _id: string;
    status: string;
    bookingReference?: string;
    totalAmount: number;
  };
  payment?: {
    _id: string;
    status: string;
    transactionId?: string;
    walletAmount?: number;
  };
}

export interface MockPaymentResponse {
  success: boolean;
  message: string;
  booking: {
    _id: string;
    status: string;
    bookingReference?: string;
    totalAmount: number;
  };
  payment?: {
    _id: string;
    status: string;
    transactionId?: string;
    walletAmount?: number;
  };
  difference?: number;
  targetTotalAmount?: number;
}

export async function createPaymentOrder(
  bookingId: string,
  useWallet = false
): Promise<CreatePaymentOrderResponse> {
  const response = await api.post<CreatePaymentOrderResponse>(
    "/payments/create-order",
    {
      bookingId,
      useWallet,
    }
  );

  return response.data;
}

export async function createReschedulePaymentOrder(data: {
  bookingId: string;
  showId: string;
  seatIds: string[];
}): Promise<CreateReschedulePaymentOrderResponse> {
  const response = await api.post<CreateReschedulePaymentOrderResponse>(
    "/payments/reschedule-create-order",
    data
  );

  return response.data;
}

export async function verifyPayment(data: {
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<VerifyPaymentResponse> {
  const response = await api.post<VerifyPaymentResponse>(
    "/payments/verify",
    data
  );

  return response.data;
}

export async function mockPaymentSuccess(
  bookingId: string,
  useWallet = false
): Promise<MockPaymentResponse> {
  const response = await api.post<MockPaymentResponse>(
    "/payments/mock-success",
    {
      bookingId,
      useWallet,
    }
  );

  return response.data;
}

export async function mockReschedulePaymentSuccess(data: {
  bookingId: string;
  showId: string;
  seatIds: string[];
}): Promise<MockPaymentResponse> {
  const response = await api.post<MockPaymentResponse>(
    "/payments/mock-reschedule-success",
    data
  );

  return response.data;
}
