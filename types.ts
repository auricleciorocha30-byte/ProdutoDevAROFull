
export type OrderStatus = 'PREPARANDO' | 'PRONTO' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE' | 'CANCELADO';
export type OrderType = 'MESA' | 'BALCAO' | 'ENTREGA' | 'COMANDA';
export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO';

export interface StoreProfile {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  address: string;
  whatsapp: string;
  isActive: boolean;
  createdAt: number;
  settings: StoreSettings;
}

export interface Waitstaff {
  id: string;
  store_id?: string;
  name: string;
  password?: string;
  role: 'GERENTE' | 'ATENDENTE' | 'ENTREGADOR';
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  showInMenu?: boolean;
  featuredDay?: number;
  isByWeight?: boolean;
  store_id?: string;
  barcode?: string;
  stock?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  isByWeight?: boolean;
  isPersisted?: boolean;
  originalQuantity?: number;
}

export interface Order {
  id: string;
  store_id?: string;
  type: OrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: number;
  paymentMethod?: PaymentMethod;
  deliveryAddress?: string;
  notes?: string;
  changeFor?: number;
  waitstaffName?: string;
  couponApplied?: string;
  discountAmount?: number;
  isSynced?: boolean;
  deliveryDriverId?: string;
  paymentDetails?: string; // JSON string of { method: string, amount: number }[]
  session_id?: string;
}

export interface CashMovement {
  id: string;
  store_id: string;
  type: 'SANGRIA' | 'SUPRIMENTO' | 'ABERTURA_CAIXA' | 'FECHAMENTO_CAIXA';
  amount: number;
  description: string;
  waitstaffName: string;
  createdAt: number;
  session_id?: string;
}

export interface RegisterSession {
  id: string;
  store_id: string;
  waitstaff_id: string;
  waitstaff_name: string;
  opened_at: number;
  closed_at?: number;
  initial_amount: number;
  closed_amount?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface StoreSettings {
  isStoreOpen?: boolean;
  isDeliveryActive: boolean;
  isTableOrderActive: boolean;
  isCounterPickupActive: boolean;
  isKitchenActive?: boolean;
  isTvPanelActive?: boolean;
  storeName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  canWaitstaffFinishOrder: boolean;
  canWaitstaffCancelItems: boolean;
  thermalPrinterWidth: '80mm' | '58mm';
  address?: string;
  whatsapp?: string;
  couponName?: string;
  couponDiscount?: number;
  isCouponActive?: boolean;
  isCouponForAllProducts?: boolean;
  applicableProductIds?: string[];
  lastUpdate?: number;
  pixQrCodeUrl?: string;
  usbPrinterVendorId?: number;
  usbPrinterProductId?: number;
}
