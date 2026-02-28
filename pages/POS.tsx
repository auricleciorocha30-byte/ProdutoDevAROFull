import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  X, 
  CheckCircle2, 
  Printer, 
  LogOut,
  Package,
  AlertCircle,
  Truck,
  User,
  MapPin,
  Phone,
  Calculator,
  DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Order, OrderItem, StoreSettings, Waitstaff, PaymentMethod } from '../types';
import { useNavigate } from 'react-router-dom';

interface POSProps {
  storeId: string;
  user: Waitstaff;
  settings: StoreSettings;
  onLogout: () => void;
}

interface Payment {
  method: PaymentMethod;
  amount: number;
}

export default function POS({ storeId, user, settings, onLogout }: POSProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [couriers, setCouriers] = useState<Waitstaff[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Checkout State
  const [orderType, setOrderType] = useState<'BALCAO' | 'ENTREGA'>('BALCAO');
  const [deliveryDetails, setDeliveryDetails] = useState({
    customerName: '',
    customerPhone: '',
    address: '',
    driverId: '',
    payOnDelivery: false
  });
  
  // Payment State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  // Weight Modal
  const [weightModal, setWeightModal] = useState<{ isOpen: boolean, product: Product | null }>({ isOpen: false, product: null });
  const [weightInput, setWeightInput] = useState('');

  // Register Closing
  const [isClosingRegister, setIsClosingRegister] = useState(false);
  const [dailySales, setDailySales] = useState<{ total: number, byMethod: Record<string, number>, count: number, bleeds: number } | null>(null);
  
  // Session State
  const [currentSession, setCurrentSession] = useState<RegisterSession | null>(null);
  const [isOpeningRegister, setIsOpeningRegister] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  
  // Cash Bleed (Sangria)
  const [isBleedModalOpen, setIsBleedModalOpen] = useState(false);
  const [bleedAmount, setBleedAmount] = useState('');
  const [bleedReason, setBleedReason] = useState('');

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  useEffect(() => {
    fetchProducts();
    fetchCouriers();
    fetchSession();
  }, [storeId]);

  const fetchSession = async () => {
    const { data } = await supabase
      .from('register_sessions')
      .select('*')
      .eq('store_id', storeId)
      .eq('waitstaff_id', user.id)
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      setCurrentSession(data[0]);
    } else {
      setCurrentSession(null);
      setIsOpeningRegister(true);
    }
  };

  const handleOpenRegister = async () => {
    const amount = parseFloat(initialAmount) || 0;
    const session: Partial<RegisterSession> = {
      id: crypto.randomUUID(),
      store_id: storeId,
      waitstaff_id: user.id,
      waitstaff_name: user.name,
      opened_at: Date.now(),
      initial_amount: amount,
      status: 'OPEN'
    };

    const { data, error } = await supabase.from('register_sessions').insert([session]);
    if (!error && data && data.length > 0) {
      setCurrentSession(data[0]);
      setIsOpeningRegister(false);
      
      if (amount > 0) {
        await supabase.from('cash_movements').insert([{
          id: crypto.randomUUID(),
          store_id: storeId,
          type: 'ABERTURA_CAIXA',
          amount: amount,
          description: 'Troco inicial',
          waitstaffName: user.name,
          createdAt: Date.now(),
          session_id: data[0].id
        }]);
      }
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('isActive', true);
    if (data) setProducts(data);
  };

  const fetchCouriers = async () => {
    const { data } = await supabase
      .from('waitstaff')
      .select('*')
      .eq('store_id', storeId)
      .eq('role', 'ENTREGADOR');
    if (data) setCouriers(data);
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['Todos', ...cats];
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.barcode?.includes(search);
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProductClick = (product: Product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      alert("Produto sem estoque!");
      return;
    }

    if (product.isByWeight) {
      setWeightModal({ isOpen: true, product });
      setWeightInput('');
    } else {
      addToCart(product, 1);
    }
  };

  const addToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        description: product.description,
        isByWeight: product.isByWeight
      }];
    });
    setWeightModal({ isOpen: false, product: null });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        let newQty = item.quantity + delta;
        newQty = Math.round(newQty * 1000) / 1000;
        newQty = Math.max(0, newQty);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);

  const handleAddPayment = () => {
    const amount = parseFloat(currentPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setPayments(prev => [...prev, { method: currentPaymentMethod, amount }]);
    setCurrentPaymentAmount('');
  };

  const handleRemovePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    const isPayOnDelivery = orderType === 'ENTREGA' && deliveryDetails.payOnDelivery;
    
    if (remaining > 0.01 && !isPayOnDelivery) {
      alert(`Falta pagar ${formatCurrency(remaining)}`);
      return;
    }
    
    setIsProcessing(true);

    try {
      const order: Partial<Order> = {
        store_id: storeId,
        type: orderType,
        items: cart,
        status: orderType === 'ENTREGA' ? 'PRONTO' : 'PRONTO',
        total: total,
        createdAt: Date.now(),
        paymentMethod: isPayOnDelivery ? 'A_PAGAR' as any : (payments.length === 1 ? payments[0].method : 'MISTO' as any),
        paymentDetails: isPayOnDelivery ? '[]' : JSON.stringify(payments),
        waitstaffName: user.name,
        changeFor: change > 0 ? total + change : undefined,
        isSynced: false,
        customerName: orderType === 'ENTREGA' ? deliveryDetails.customerName : undefined,
        customerPhone: orderType === 'ENTREGA' ? deliveryDetails.customerPhone : undefined,
        deliveryAddress: orderType === 'ENTREGA' ? deliveryDetails.address : undefined,
        deliveryDriverId: orderType === 'ENTREGA' && deliveryDetails.driverId ? deliveryDetails.driverId : undefined,
        session_id: currentSession?.id
      };

      // FIX: Removed .select().single() because insert returns { data, error } directly
      const { data, error } = await supabase.from('orders').insert([order]);
      
      if (error) throw error;

      // Update stock
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product && product.stock !== undefined) {
          await supabase
            .from('products')
            .eq('id', product.id)
            .update({ stock: product.stock - item.quantity });
        }
      }

      const newOrder = data ? data[0] : null;
      if (newOrder) {
        setLastOrder(newOrder);
        // Auto print or show print option
        if (confirm("Venda realizada! Deseja imprimir o cupom?")) {
            printReceipt(newOrder);
        }
      }

      setCart([]);
      setPayments([]);
      setDeliveryDetails({ customerName: '', customerPhone: '', address: '', driverId: '', payOnDelivery: false });
      setIsCheckoutOpen(false);
      fetchProducts(); // Refresh stock
      
    } catch (err: any) {
      alert("Erro ao finalizar venda: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBleed = async () => {
      const amount = parseFloat(bleedAmount);
      if (isNaN(amount) || amount <= 0) {
          alert("Valor inválido");
          return;
      }
      if (!bleedReason) {
          alert("Informe o motivo");
          return;
      }

      try {
          const { error } = await supabase.from('cash_movements').insert([{
              store_id: storeId,
              type: 'SANGRIA',
              amount: amount,
              description: bleedReason,
              waitstaffName: user.name,
              createdAt: Date.now(),
              session_id: currentSession?.id
          }]);

          if (error) throw error;

          alert("Sangria realizada com sucesso!");
          setBleedAmount('');
          setBleedReason('');
          setIsBleedModalOpen(false);
      } catch (err: any) {
          alert("Erro ao realizar sangria: " + err.message);
      }
  };

  const handleCloseRegister = async () => {
    setIsClosingRegister(true);

    try {
      const sessionId = currentSession?.id;
      let orders: any[] = [];
      let movements: any[] = [];

      if (sessionId) {
        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .eq('session_id', sessionId);
        
        const { data: sessionMovements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('store_id', storeId)
          .eq('session_id', sessionId)
          .eq('type', 'SANGRIA');

        orders = sessionOrders || [];
        movements = sessionMovements || [];
      } else {
        // Fallback for older data without session_id
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = today.getTime();

        const { data: todayOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .gte('createdAt', startOfDay);
        
        const { data: todayMovements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('store_id', storeId)
          .gte('createdAt', startOfDay)
          .eq('type', 'SANGRIA');

        orders = todayOrders || [];
        movements = todayMovements || [];
      }

      const bleedsTotal = movements.reduce((acc, m) => acc + m.amount, 0);

      const sales = (orders as Order[] || []).reduce((acc, order) => {
        acc.total += order.total;
        acc.count += 1;
        
        // Parse payment details if available, otherwise use paymentMethod
        let orderPayments: Payment[] = [];
        if (order.paymentDetails) {
            try { orderPayments = JSON.parse(order.paymentDetails); } catch(e) {}
        } else if (order.paymentMethod) {
            orderPayments = [{ method: order.paymentMethod, amount: order.total }];
        }

        orderPayments.forEach(p => {
            acc.byMethod[p.method] = (acc.byMethod[p.method] || 0) + p.amount;
        });

        return acc;
      }, { total: 0, byMethod: {} as Record<string, number>, count: 0, bleeds: bleedsTotal });
      
      setDailySales(sales);
    } catch (err) {
      console.error(err);
      setDailySales({ total: 0, byMethod: {}, count: 0, bleeds: 0 });
    }
  };

  const confirmCloseRegister = async () => {
    if (!currentSession) return;
    
    try {
      const closedAmount = (dailySales?.total || 0) + currentSession.initial_amount - (dailySales?.bleeds || 0);
      
      await supabase
        .from('register_sessions')
        .eq('id', currentSession.id)
        .update({
          status: 'CLOSED',
          closed_at: Date.now(),
          closed_amount: closedAmount
        });

      await supabase.from('cash_movements').insert([{
        id: crypto.randomUUID(),
        store_id: storeId,
        type: 'FECHAMENTO_CAIXA',
        amount: closedAmount,
        description: 'Fechamento de caixa',
        waitstaffName: user.name,
        createdAt: Date.now(),
        session_id: currentSession.id
      }]);
      
      setCurrentSession(null);
      setIsClosingRegister(false);
      setDailySales(null);
      setIsOpeningRegister(true);
    } catch (err) {
      console.error("Erro ao fechar caixa:", err);
      alert("Erro ao fechar o caixa. Tente novamente.");
    }
  };

  const printReceipt = (order: Order) => {
    const content = `
      <div style="font-family: monospace; width: 300px; font-size: 12px;">
        <h2 style="text-align: center; margin: 0;">${settings.storeName}</h2>
        <p style="text-align: center; margin: 0 0 10px 0;">CNPJ: 00.000.000/0000-00</p>
        <p>Data: ${new Date(order.createdAt).toLocaleString()}</p>
        <p>Pedido: #${order.id}</p>
        <p>Cliente: ${order.customerName || 'Consumidor'}</p>
        <hr />
        ${order.items.map((item: any) => `
          <div style="display: flex; justify-content: space-between;">
            <span>${item.quantity}x ${item.name}</span>
            <span>${formatCurrency(item.price * item.quantity)}</span>
          </div>
        `).join('')}
        <hr />
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>TOTAL</span>
          <span>${formatCurrency(order.total)}</span>
        </div>
        <p>Pagamento: ${order.paymentMethod}</p>
        ${order.changeFor ? `<p>Troco para: ${formatCurrency(order.changeFor)}</p>` : ''}
        <br />
        <p style="text-align: center;">Obrigado pela preferência!</p>
      </div>
    `;

    const win = window.open('', '', 'width=350,height=600');
    if (win) {
      win.document.write(content);
      win.document.close();
      win.focus();
      win.print();
      win.close();
    }
  };
  
  const printDailyReport = () => {
      if (!dailySales) return;
      
      const initial = currentSession?.initial_amount || 0;
      const totalInBox = dailySales.total + initial - dailySales.bleeds;

      const content = `
      <div style="font-family: monospace; width: 300px; font-size: 12px;">
        <h2 style="text-align: center; margin: 0;">FECHAMENTO DE CAIXA</h2>
        <p style="text-align: center; margin: 0 0 10px 0;">${settings.storeName}</p>
        <p>Data: ${new Date().toLocaleString()}</p>
        <p>Operador: ${user.name}</p>
        <hr />
        <p><strong>Troco Inicial:</strong> ${formatCurrency(initial)}</p>
        <p><strong>Vendas Totais:</strong> ${dailySales.count}</p>
        <p><strong>Faturamento Bruto:</strong> ${formatCurrency(dailySales.total)}</p>
        <hr />
        <p><strong>Por Método:</strong></p>
        ${Object.entries(dailySales.byMethod).map(([method, amount]) => `
            <div style="display: flex; justify-content: space-between;">
                <span>${method}</span>
                <span>${formatCurrency(amount)}</span>
            </div>
        `).join('')}
        <hr />
        <div style="display: flex; justify-content: space-between;">
            <span>Total Sangrias</span>
            <span>- ${formatCurrency(dailySales.bleeds)}</span>
        </div>
        <hr />
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
            <span>Total em Caixa</span>
            <span>${formatCurrency(totalInBox)}</span>
        </div>
        <br />
        <p style="text-align: center;">--- Fim do Relatório ---</p>
      </div>
    `;

    const win = window.open('', '', 'width=350,height=600');
    if (win) {
      win.document.write(content);
      win.document.close();
      win.focus();
      win.print();
      win.close();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-gray-900">
      {/* Left Side - Products */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white p-4 shadow-sm flex justify-between items-center z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-800">PDV - {settings.storeName}</h1>
            <p className="text-xs text-gray-500">Operador: {user.name}</p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setIsBleedModalOpen(true)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-full flex items-center gap-2 px-4 border border-orange-100" title="Sangria">
                <Minus size={20} />
                <span className="text-sm font-bold">Sangria</span>
             </button>
             <button onClick={handleCloseRegister} className="p-2 text-green-600 hover:bg-green-50 rounded-full flex items-center gap-2 px-4 border border-green-100" title="Fechar Caixa">
                <DollarSign size={20} />
                <span className="text-sm font-bold">Fechar Caixa</span>
             </button>
             {lastOrder && (
               <button onClick={() => printReceipt(lastOrder)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full" title="Reimprimir Último Cupom">
                  <Printer size={20} />
               </button>
             )}
             <button onClick={() => window.location.reload()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Atualizar">
                <Package size={20} />
             </button>
             <button onClick={onLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-full" title="Sair">
                <LogOut size={20} />
             </button>
          </div>
        </header>
        
        {/* ... (rest of the component) */}

        <div className="p-4 bg-white border-b flex gap-4 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 overflow-y-auto bg-gray-50">
          <div className="mb-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar produto por nome ou código de barras..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const exactMatch = products.find(p => p.barcode === search);
                  if (exactMatch) {
                    handleProductClick(exactMatch);
                    setSearch('');
                  } else if (filteredProducts.length === 1) {
                    handleProductClick(filteredProducts[0]);
                    setSearch('');
                  }
                }
              }}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex flex-col h-full group"
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-gray-100 relative">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package size={32} />
                    </div>
                  )}
                  {product.stock !== undefined && (
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm ${product.stock > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                      {product.stock > 0 ? `${product.stock} un` : 'Sem Estoque'}
                    </div>
                  )}
                  {product.isByWeight && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm bg-blue-500 text-white">
                      KG
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-gray-800 text-sm line-clamp-2 mb-1 group-hover:text-blue-600">{product.name}</h3>
                <div className="mt-auto flex justify-between items-end">
                  <span className="font-black text-lg text-gray-900">{formatCurrency(product.price)}</span>
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={16} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-96 bg-white shadow-xl flex flex-col border-l border-gray-200 z-20">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={20} />
            Carrinho Atual
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 opacity-50">
              <ShoppingCart size={48} />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800 line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(item.price)} {item.isByWeight ? '/ kg' : 'un'}</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                  <button onClick={() => updateQuantity(item.productId, item.isByWeight ? -0.1 : -1)} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-bold w-12 text-center">
                    {item.isByWeight ? item.quantity.toFixed(3) : item.quantity}
                  </span>
                  <button onClick={() => updateQuantity(item.productId, item.isByWeight ? 0.1 : 1)} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-blue-600">
                    <Plus size={14} />
                  </button>
                </div>
                <button onClick={() => updateQuantity(item.productId, -item.quantity)} className="p-2 text-red-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-gray-500 font-medium">Total a Pagar</span>
            <span className="text-3xl font-black text-gray-900">{formatCurrency(total)}</span>
          </div>
          
          <button 
            onClick={() => {
                setIsCheckoutOpen(true);
                setPayments([]);
                setCurrentPaymentAmount(total.toFixed(2));
            }}
            disabled={cart.length === 0}
            className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={24} />
            Finalizar Venda
          </button>
        </div>
      </div>

      {/* Weight Modal */}
      {weightModal.isOpen && weightModal.product && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">Informe o Peso (Gramas)</h3>
            <p className="text-sm text-gray-500 mb-4">{weightModal.product.name}</p>
            <div className="relative mb-6">
                <input 
                    type="number" 
                    step="1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">g</span>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setWeightModal({ isOpen: false, product: null })} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">Cancelar</button>
                <button 
                    onClick={() => {
                        const weight = parseFloat(weightInput);
                        if (weight > 0) addToCart(weightModal.product!, weight / 1000);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold"
                >
                    Confirmar
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Finalizar Venda</h2>
              <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex border-b">
                <button 
                    onClick={() => setOrderType('BALCAO')}
                    className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider ${orderType === 'BALCAO' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400'}`}
                >
                    Balcão
                </button>
                <button 
                    onClick={() => setOrderType('ENTREGA')}
                    className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider ${orderType === 'ENTREGA' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400'}`}
                >
                    Entrega
                </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {orderType === 'ENTREGA' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-blue-700 uppercase">Cliente</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.customerName}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, customerName: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="Nome do Cliente"
                              />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-blue-700 uppercase">Telefone</label>
                          <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.customerPhone}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, customerPhone: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="(00) 00000-0000"
                              />
                          </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Endereço</label>
                          <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.address}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, address: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="Endereço completo"
                              />
                          </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Entregador (Opcional)</label>
                          <div className="relative">
                              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <select 
                                  value={deliveryDetails.driverId}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, driverId: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                              >
                                  <option value="">Em Aberto (Qualquer Entregador)</option>
                                  {couriers.map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                              </select>
                          </div>
                      </div>
                      <div className="space-y-1 md:col-span-2 flex items-center gap-2 mt-2">
                          <input 
                              type="checkbox" 
                              id="payOnDelivery"
                              checked={deliveryDetails.payOnDelivery}
                              onChange={e => setDeliveryDetails({...deliveryDetails, payOnDelivery: e.target.checked})}
                              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                          />
                          <label htmlFor="payOnDelivery" className="text-sm font-bold text-blue-800 cursor-pointer">
                              Pagar no ato da entrega
                          </label>
                      </div>
                  </div>
              )}

              <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                      <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Total a Pagar</p>
                        <p className="text-3xl font-black text-gray-900">{formatCurrency(total)}</p>
                        <p className="text-xs text-red-500 font-bold mt-1">Restante: {formatCurrency(remaining)}</p>
                      </div>

                      <div className="space-y-2">
                          {orderType === 'ENTREGA' && deliveryDetails.payOnDelivery ? (
                              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm font-bold text-center">
                                  Pagamento será realizado no ato da entrega.
                              </div>
                          ) : (
                              <>
                                  <label className="text-xs font-bold text-gray-500 uppercase">Adicionar Pagamento</label>
                                  <div className="flex gap-2">
                                      <input 
                                          type="number" 
                                          value={currentPaymentAmount}
                                          onChange={e => setCurrentPaymentAmount(e.target.value)}
                                          className="flex-1 p-3 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholder="Valor"
                                      />
                                      <select 
                                          value={currentPaymentMethod}
                                          onChange={e => setCurrentPaymentMethod(e.target.value as PaymentMethod)}
                                          className="p-3 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                      >
                                          <option value="DINHEIRO">Dinheiro</option>
                                          <option value="CARTAO">Cartão</option>
                                          <option value="PIX">Pix</option>
                                      </select>
                                      <button 
                                          onClick={handleAddPayment}
                                          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                                      >
                                          <Plus size={20} />
                                      </button>
                                  </div>
                                  
                                  {currentPaymentMethod === 'CARTAO' && currentPaymentAmount && !isNaN(parseFloat(currentPaymentAmount)) && (
                                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
                                          <p className="font-bold uppercase">Simulação de Parcelamento</p>
                                          <div className="grid grid-cols-3 gap-2">
                                              {[1, 2, 3, 4, 5, 6].map(i => (
                                                  <div key={i} className="bg-white p-1 rounded border border-blue-100 text-center">
                                                      <span className="font-bold">{i}x</span> {formatCurrency(parseFloat(currentPaymentAmount) / i)}
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                              </>
                          )}
                      </div>

                      {currentPaymentMethod === 'PIX' && (!orderType || orderType !== 'ENTREGA' || !deliveryDetails.payOnDelivery) && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-4">
                          {settings.pixQrCodeUrl ? (
                            <img src={settings.pixQrCodeUrl} alt="QR Pix" className="w-16 h-16 object-contain mix-blend-multiply" />
                          ) : (
                            <QrCode size={32} className="text-gray-400" />
                          )}
                          <div className="flex-1">
                              <p className="text-xs font-bold text-gray-700">QR Code Pix</p>
                              <p className="text-[10px] text-gray-500">Escaneie para pagar</p>
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-200 h-64 overflow-y-auto">
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Pagamentos Lançados</h3>
                      {payments.length === 0 ? (
                          <p className="text-center text-gray-400 text-sm mt-10">Nenhum pagamento adicionado</p>
                      ) : (
                          <div className="space-y-2">
                              {payments.map((p, i) => (
                                  <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                                      <div className="flex items-center gap-2">
                                          {p.method === 'DINHEIRO' && <Banknote size={16} className="text-green-600" />}
                                          {p.method === 'CARTAO' && <CreditCard size={16} className="text-blue-600" />}
                                          {p.method === 'PIX' && <QrCode size={16} className="text-purple-600" />}
                                          <span className="font-bold text-sm">{p.method}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <span className="font-bold">{formatCurrency(p.amount)}</span>
                                          <button onClick={() => handleRemovePayment(i)} className="text-red-400 hover:text-red-600">
                                              <Trash2 size={14} />
                                          </button>
                                      </div>
                                  </div>
                              ))}
                              {change > 0 && (
                                  <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100">
                                      <span className="font-bold text-green-700 text-sm">Troco</span>
                                      <span className="font-black text-green-700">{formatCurrency(change)}</span>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>

            </div>

            <div className="p-6 border-t bg-gray-50">
              <button 
                onClick={handleCheckout}
                disabled={isProcessing || remaining > 0.01}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <CheckCircle2 size={24} />}
                Finalizar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {isClosingRegister && dailySales && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <DollarSign size={24} className="text-green-600" />
                    Fechamento de Caixa
                </h2>
                
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                        <span className="text-gray-600 font-medium">Vendas Hoje</span>
                        <span className="font-bold text-xl">{dailySales.count}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl text-blue-800">
                        <span className="font-medium">Total Bruto</span>
                        <span className="font-black text-2xl">{formatCurrency(dailySales.total)}</span>
                    </div>
                    
                    <div className="border-t pt-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Por Método</p>
                        <div className="space-y-2">
                            {Object.entries(dailySales.byMethod).map(([method, amount]) => (
                                <div key={method} className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-600">{method}</span>
                                    <span className="font-bold">{formatCurrency(amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-orange-50 text-orange-800 rounded-xl">
                        <span className="font-medium">Total Sangrias</span>
                        <span className="font-bold text-lg">- {formatCurrency(dailySales.bleeds)}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-gray-50 text-gray-800 rounded-xl">
                        <span className="font-medium">Troco Inicial</span>
                        <span className="font-bold text-lg">{formatCurrency(currentSession?.initial_amount || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-green-50 text-green-800 rounded-xl border border-green-100">
                        <span className="font-bold uppercase">Total em Caixa</span>
                        <span className="font-bold text-xl">{formatCurrency(dailySales.total - dailySales.bleeds + (currentSession?.initial_amount || 0))}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsClosingRegister(false)}
                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmCloseRegister}
                        className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                        <DollarSign size={18} /> Confirmar Fechamento
                    </button>
                    <button 
                        onClick={printDailyReport}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <Printer size={18} /> Imprimir
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Opening Register Modal */}
      {isOpeningRegister && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <DollarSign size={24} className="text-green-600" />
              Abertura de Caixa
            </h2>
            <p className="text-gray-600 mb-4 text-sm">Informe o valor de troco inicial para abrir o caixa.</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Troco Inicial (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={initialAmount}
                  onChange={e => setInitialAmount(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-bold"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={onLogout}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                Sair
              </button>
              <button 
                onClick={handleOpenRegister}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <DollarSign size={18} /> Abrir Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bleed Modal */}
      {isBleedModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-orange-600 mb-6 flex items-center gap-2">
                <Minus size={24} />
                Realizar Sangria
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input 
                      type="number" 
                      value={bleedAmount}
                      onChange={e => setBleedAmount(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500 font-bold text-lg"
                      placeholder="0.00"
                      autoFocus
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Descrição</label>
                  <input 
                      type="text" 
                      value={bleedReason}
                      onChange={e => setBleedReason(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Ex: Pagamento fornecedor, retirada..."
                  />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsBleedModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBleed}
                className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
