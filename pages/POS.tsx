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
  DollarSign,
  Tag,
  Loader2,
  RefreshCw,
  Hash,
  ShoppingBag,
  Ticket,
  Wifi,
  WifiOff,
  ScanLine,
  Camera
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Order, OrderItem, StoreSettings, Waitstaff, PaymentMethod, Customer } from '../types';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

import InstallPrompt from '../components/InstallPrompt';

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
  const [originalCart, setOriginalCart] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Checkout State
  const [orderType, setOrderType] = useState<'BALCAO' | 'ENTREGA' | 'COMANDA'>('BALCAO');
  const [commandNumber, setCommandNumber] = useState('');
  const [isAutoFinalize, setIsAutoFinalize] = useState(() => {
    const saved = localStorage.getItem('pos-auto-finalize');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('pos-auto-finalize', isAutoFinalize.toString());
  }, [isAutoFinalize]);

  const [deliveryDetails, setDeliveryDetails] = useState({
    customerName: '',
    customerPhone: '',
    address: '',
    referencePoint: '',
    driverId: '',
    payOnDelivery: false,
    useStoreOrigin: true,
    originAddress: ''
  });
  
  // Payment State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [loadedCommandIds, setLoadedCommandIds] = useState<string[]>([]);
  const [isLookingUpCommand, setIsLookingUpCommand] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryOrdersList, setDeliveryOrdersList] = useState<Order[]>([]);
  const [deliverySearchTerm, setDeliverySearchTerm] = useState('');
  
  const [isContingencyMode, setIsContingencyMode] = useState(() => {
    return localStorage.getItem(`contingency_mode_${storeId}`) === 'true';
  });
  const [contingencyOrders, setContingencyOrders] = useState<Order[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (showScanner) {
      html5QrCode = new Html5Qrcode("pos-reader");
      
      const startScanner = async () => {
        try {
          await html5QrCode?.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 }
            },
            (decodedText) => {
              setSearch(decodedText);
              // Trigger search
              const exactMatch = products.find(p => p.barcode === decodedText);
              if (exactMatch) {
                handleProductClick(exactMatch);
                setSearch('');
              }
              html5QrCode?.stop().then(() => {
                setShowScanner(false);
              }).catch(console.error);
            },
            (errorMessage) => {
              // parse error, ignore
            }
          );
        } catch (err) {
          console.error("Error starting scanner:", err);
          alert("Erro ao iniciar a câmera. Verifique as permissões.");
          setShowScanner(false);
        }
      };

      startScanner();
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [showScanner, products]);

  useEffect(() => {
    localStorage.setItem(`contingency_mode_${storeId}`, isContingencyMode.toString());
  }, [isContingencyMode, storeId]);

  useEffect(() => {
    const saved = localStorage.getItem(`contingency_orders_${storeId}`);
    if (saved) {
      try {
        setContingencyOrders(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing contingency orders', e);
      }
    }
  }, [storeId]);

  const syncContingencyOrders = async () => {
    if (contingencyOrders.length === 0) return;
    setIsProcessing(true);
    try {
      for (const order of contingencyOrders) {
        const { id, ...orderData } = order as any; // Remove local ID
        const { error } = await supabase.from('orders').insert([orderData]);
        if (error) throw error;

        // Update stock
        const stockUpdates = new Map<string, number>();
        for (const newItem of order.items) {
            const current = stockUpdates.get(newItem.productId) || 0;
            stockUpdates.set(newItem.productId, current - newItem.quantity);
        }

        for (const [productId, diff] of stockUpdates.entries()) {
            if (diff !== 0) {
                const product = products.find(p => p.id === productId);
                if (product && product.stock != null) {
                    const newStock = product.stock + diff;
                    const updates: any = { stock: newStock };
                    
                    if (newStock <= 0) {
                        updates.isactive = false;
                    } else {
                        updates.isactive = true;
                    }

                    await supabase
                        .from('products')
                        .eq('id', product.id)
                        .update(updates);
                }
            }
        }
      }
      setContingencyOrders([]);
      localStorage.removeItem(`contingency_orders_${storeId}`);
      fetchProducts(); // Refresh stock
      alert("Pedidos sincronizados com sucesso!");
    } catch (err: any) {
      alert("Erro ao sincronizar pedidos: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const lookupCommand = async (num: string, type: 'MESA' | 'COMANDA' | 'BALCAO' | 'ENTREGA' = 'COMANDA') => {
    if (!num) return;
    if (isContingencyMode) {
        alert("A busca de comandas/mesas não está disponível no Modo Contingência.");
        return;
    }
    const cleanNum = num.trim();
    setIsLookingUpCommand(true);
    try {
        let query = supabase
            .from('orders')
            .select('*')
            .eq('store_id', storeId)
            .eq('type', type)
            .in('status', ['AGUARDANDO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'CHEGUEI_NA_ORIGEM']);

        if (type === 'MESA' || type === 'COMANDA') {
            query = query.eq('tableNumber', cleanNum);
        } else {
            query = query.eq('displayId', cleanNum);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
            let targetCart: OrderItem[] = [];
            let targetLoadedIds: string[] = [];
            let shouldMerge = false;

            if (cart.length > 0) {
                shouldMerge = confirm(`Já existem itens no carrinho. Deseja SOMAR os pedidos da ${type === 'MESA' ? 'Mesa' : type === 'COMANDA' ? 'Comanda' : 'Pedido'} ${cleanNum} ao pedido atual? \n\nOK = SOMAR\nCancelar = SUBSTITUIR (Limpar atual)`);
                if (shouldMerge) {
                    targetCart = cart.map(item => ({...item}));
                    targetLoadedIds = [...loadedCommandIds];
                }
            }

            const newOrderIds: string[] = [];
            
            data.forEach(order => {
                if (targetLoadedIds.includes(order.id)) return; // Already loaded
                newOrderIds.push(order.id);
                
                let items = [];
                if (typeof order.items === 'string') {
                    try {
                        items = JSON.parse(order.items);
                    } catch (e) {
                        console.error("Error parsing items for order", order.id, e);
                    }
                } else if (Array.isArray(order.items)) {
                    items = order.items;
                }
                
                items.forEach((item: any) => {
                    // Stock Check Logic
                    const product = products.find(p => p.id === item.productId);
                    const existingItem = targetCart.find(tc => tc.productId === item.productId && tc.isByWeight === item.isByWeight);
                    const currentQty = existingItem ? existingItem.quantity : 0;
                    
                    let qtyToAdd = item.quantity;

                    if (product && product.stock != null) {
                        if ((currentQty + qtyToAdd) > product.stock) {
                            const available = Math.max(0, product.stock - currentQty);
                            if (available < qtyToAdd) {
                                alert(`Atenção: O produto "${item.name}" tem estoque insuficiente para somar (${product.stock}). Adicionando apenas ${available} itens.`);
                                qtyToAdd = available;
                            }
                        }
                    }

                    if (qtyToAdd > 0) {
                        if (existingItem) {
                            existingItem.quantity += qtyToAdd;
                            existingItem.originalQuantity = (existingItem.originalQuantity || 0) + qtyToAdd;
                        } else {
                            targetCart.push({ 
                                ...item, 
                                quantity: qtyToAdd,
                                isPersisted: true, 
                                originalQuantity: qtyToAdd 
                            });
                        }
                    }
                });
            });

            setCart(targetCart);
            setOriginalCart(JSON.parse(JSON.stringify(targetCart)));
            setLoadedCommandIds([...targetLoadedIds, ...newOrderIds]);
            
            if (!shouldMerge) {
                if (type === 'MESA' || type === 'COMANDA') {
                    setCommandNumber(cleanNum);
                } else {
                    // For BALCAO and ENTREGA, we load the order details
                    const order = data[0];
                    setDeliveryDetails({
                        customerName: order.customerName || '',
                        customerPhone: order.customerPhone || '',
                        address: order.deliveryAddress || '',
                        referencePoint: order.referencePoint || '',
                        driverId: order.deliveryDriverId || '',
                        payOnDelivery: false,
                        useStoreOrigin: true,
                        originAddress: ''
                    });
                }
                setOrderType(type);
            }
            
            alert(`${type === 'MESA' ? 'Mesa' : type === 'COMANDA' ? 'Comanda' : 'Pedido'} ${cleanNum} carregada com sucesso.`);
        } else {
            alert(`Nenhum pedido em aberto para a ${type === 'MESA' ? 'Mesa' : type === 'COMANDA' ? 'Comanda' : 'Pedido'} ${cleanNum}.`);
        }
    } catch (err) {
        console.error("Erro ao consultar:", err);
        alert("Erro ao consultar.");
    } finally {
        setIsLookingUpCommand(false);
    }
  };

  const [lookupType, setLookupType] = useState<'ENTREGA' | 'BALCAO'>('ENTREGA');

  const lookupOrdersList = async (type: 'ENTREGA' | 'BALCAO') => {
    setIsLookingUpCommand(true);
    setLookupType(type);
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('store_id', storeId)
            .eq('type', type)
            .in('status', ['AGUARDANDO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'CHEGUEI_NA_ORIGEM']);

        if (error) throw error;

        if (data && data.length > 0) {
            const parsedData = data.map(order => {
                let items = order.items;
                if (typeof items === 'string') {
                    try {
                        items = JSON.parse(items);
                    } catch (e) {
                        console.error("Error parsing items for order", order.id, e);
                        items = [];
                    }
                }
                return {
                    ...order,
                    items: Array.isArray(items) ? items : []
                };
            });
            setDeliveryOrdersList(parsedData);
            setShowDeliveryModal(true);
        } else {
            alert(`Nenhum pedido de ${type === 'ENTREGA' ? 'entrega' : 'balcão'} pendente encontrado.`);
        }
    } catch (err) {
        console.error(err);
        alert("Erro ao buscar pedidos.");
    } finally {
        setIsLookingUpCommand(false);
    }
  };

  const loadOrderFromList = (order: Order) => {
      let items = [];
      if (typeof order.items === 'string') {
          try {
              items = JSON.parse(order.items);
          } catch (e) {
              console.error("Error parsing items for order", order.id, e);
          }
      } else if (Array.isArray(order.items)) {
          items = order.items;
      }
      
      const mappedItems = items.map((i: any) => ({ ...i, isPersisted: true, originalQuantity: i.quantity }));
      setCart(mappedItems);
      setOriginalCart(JSON.parse(JSON.stringify(mappedItems)));
      setLoadedCommandIds([order.id]);
      setOrderType(order.type as any);
      setDeliveryDetails({
          customerName: order.customerName || '',
          customerPhone: order.customerPhone || '',
          address: order.deliveryAddress || '',
          referencePoint: order.referencePoint || '',
          driverId: order.deliveryDriverId || '',
          payOnDelivery: false
      });
      setShowDeliveryModal(false);
  };

  // Weight Modal
  const [weightModal, setWeightModal] = useState<{ isOpen: boolean, product: Product | null }>({ isOpen: false, product: null });
  const [weightInput, setWeightInput] = useState('');

  // Scale Integration
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);
  const [isScaleConnected, setIsScaleConnected] = useState(false);
  const [scaleError, setScaleError] = useState('');

  const connectScale = async () => {
    if (!('serial' in navigator)) {
      setScaleError('Web Serial API não suportada neste navegador.');
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setIsScaleConnected(true);
      setScaleError('');
      
      const reader = port.readable.getReader();
      let buffer = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          // Extrai números da string (ex: "001500" -> 1500g ou "1.500" -> 1.5kg)
          const match = line.match(/(\d+\.?\d*)/);
          if (match) {
             let weight = parseFloat(match[1]);
             // Se o peso vier sem ponto decimal e for grande (ex: 1500 para 1.5kg), assumimos que é gramas
             if (weight > 100 && !line.includes('.')) {
                 weight = weight / 1000; // Converte para KG
             }
             if (!isNaN(weight) && weight > 0) {
                setScaleWeight(weight); // Peso em KG
                // Se o modal estiver aberto, atualiza o input automaticamente com o peso em gramas
                setWeightInput((weight * 1000).toFixed(0));
             }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setScaleError('Erro ao conectar balança: ' + err.message);
      setIsScaleConnected(false);
    }
  };

  // Register Closing
  const [isClosingRegister, setIsClosingRegister] = useState(false);
  const [dailySales, setDailySales] = useState<{ total: number, byMethod: Record<string, number>, count: number, bleeds: number, products: any[] } | null>(null);
  
  // Session State
  const [currentSession, setCurrentSession] = useState<any | null>(null);
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
    fetchCustomers();
  }, [storeId, isContingencyMode]);

  const fetchCustomers = async () => {
    if (!storeId || isContingencyMode) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId);
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
    }
  };

  const fetchSession = async () => {
    if (isContingencyMode) {
      setCurrentSession({ id: 'contingency_session', initial_amount: 0 });
      setIsOpeningRegister(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('register_sessions')
        .select('*')
        .eq('store_id', storeId)
        .eq('waitstaff_id', user.id)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setCurrentSession(data[0]);
      } else {
        setCurrentSession(null);
        setIsOpeningRegister(true);
      }
    } catch (e) {
      console.error("Error fetching session:", e);
      setCurrentSession(null);
      setIsOpeningRegister(true);
    }
  };

  const handleOpenRegister = async () => {
    if (isContingencyMode) {
        alert("Desative o Modo Contingência para abrir o caixa.");
        return;
    }
    try {
      const amount = parseFloat(initialAmount) || 0;
      const session: any = {
        id: crypto.randomUUID(),
        store_id: storeId,
        waitstaff_id: user.id,
        waitstaff_name: user.name,
        opened_at: Date.now(),
        initial_amount: amount,
        status: 'OPEN'
      };

      const { data, error } = await supabase.from('register_sessions').insert([session]);
      if (error) throw error;
      if (data && data.length > 0) {
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
    } catch (err: any) {
      alert("Erro ao abrir o caixa: " + err.message);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('isActive', true);
      if (error) throw error;
      if (data) {
        setProducts(data);
        localStorage.setItem(`cached_products_${storeId}`, JSON.stringify(data));
      }
    } catch (e) {
      console.error("Error fetching products:", e);
      const cached = localStorage.getItem(`cached_products_${storeId}`);
      if (cached) {
        try { setProducts(JSON.parse(cached)); } catch (err) {}
      }
    }
  };

  const fetchCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from('waitstaff')
        .select('*')
        .eq('store_id', storeId)
        .eq('role', 'ENTREGADOR');
      if (error) throw error;
      if (data) {
        setCouriers(data);
        localStorage.setItem(`cached_couriers_${storeId}`, JSON.stringify(data));
      }
    } catch (e) {
      console.error("Error fetching couriers:", e);
      const cached = localStorage.getItem(`cached_couriers_${storeId}`);
      if (cached) {
        try { setCouriers(JSON.parse(cached)); } catch (err) {}
      }
    }
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['Todos', ...cats];
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.barcode || '').includes(search);
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProductClick = (product: Product) => {
    if (product.stock != null && product.stock <= 0) {
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
      const currentQty = existing ? existing.quantity : 0;
      
      if (product.stock != null && (currentQty + quantity) > product.stock) {
        alert(`Estoque insuficiente! Disponível: ${product.stock} ${product.isByWeight ? 'KG' : 'un'}`);
        return prev;
      }

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
    const canCancel = user.role === 'GERENTE' || settings.canWaitstaffCancelItems;

    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        let newQty = item.quantity + delta;
        newQty = Math.round(newQty * 1000) / 1000;
        newQty = Math.max(0, newQty);
        
        if (delta < 0 && item.isPersisted && !canCancel) {
            if (newQty < (item.originalQuantity || 0)) {
                alert('Você não tem permissão para cancelar itens já lançados.');
                return item;
            }
        }

        if (delta > 0) {
            const product = products.find(p => p.id === productId);
            if (product && product.stock != null && newQty > product.stock) {
                alert(`Estoque insuficiente! Disponível: ${product.stock} ${product.isByWeight ? 'KG' : 'un'}`);
                return item;
            }
        }
        
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 0)), 0) + (orderType === 'ENTREGA' ? (deliveryFee || 0) : 0);
  const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);

  useEffect(() => {
    if (isCheckoutOpen) {
      setCurrentPaymentAmount(remaining.toFixed(2));
    }
  }, [total, isCheckoutOpen, remaining]);

  const handleAddPayment = () => {
    const amount = parseFloat(currentPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setPayments(prev => [...prev, { method: currentPaymentMethod, amount }]);
    setCurrentPaymentAmount('');
  };

  const handleRemovePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveToCommand = async () => {
    if (cart.length === 0) return;
    
    let num = commandNumber;
    if (!num) {
        num = prompt("Digite o número da comanda para lançar os itens:") || '';
        if (!num) return;
        setCommandNumber(num);
        setOrderType('COMANDA');
    }
    
    setIsProcessing(true);
    try {
        const order: Partial<Order> = {
            store_id: storeId,
            type: 'COMANDA',
            tableNumber: num,
            items: cart,
            status: 'PREPARANDO',
            total: total,
            createdAt: Date.now(),
            waitstaffName: user.name,
            isSynced: false,
            session_id: currentSession?.id,
            displayId: Math.floor(1000 + Math.random() * 9000).toString()
        };

        const { error } = await supabase.from('orders').insert([order]);
        if (error) throw error;

        // Se carregamos uma comanda anterior, marcamos como entregue para "substituir" pela nova versão atualizada
        if (loadedCommandIds.length > 0) {
            for (const id of loadedCommandIds) {
                await supabase
                    .from('orders')
                    .eq('id', id)
                    .update({ status: 'ENTREGUE' });
            }
        }
        
        setCart([]);
        setOriginalCart([]);
        setLoadedCommandIds([]);
        setCommandNumber('');
        setOrderType('BALCAO'); // Reset to default after saving
        alert("Itens lançados na comanda com sucesso!");
    } catch (err: any) {
        alert("Erro ao salvar comanda: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (loadedCommandIds.length === 0) return;
    
    const canCancel = user.role === 'GERENTE' || settings.canWaitstaffCancelItems;
    if (!canCancel) {
        alert('Você não tem permissão para cancelar pedidos.');
        return;
    }

    if (!window.confirm(`Tem certeza que deseja cancelar este pedido?`)) {
        return;
    }

    setIsProcessing(true);
    try {
        // Cancel the loaded orders
        for (const id of loadedCommandIds) {
            await supabase
                .from('orders')
                .eq('id', id)
                .update({ status: 'CANCELADO' });
        }

        setCart([]);
        setOriginalCart([]);
        setLoadedCommandIds([]);
        setCommandNumber('');
        setOrderType('BALCAO');
        setDeliveryDetails({
            customerName: '',
            customerPhone: '',
            address: '',
            referencePoint: '',
            driverId: '',
            payOnDelivery: false,
            useStoreOrigin: true,
            originAddress: ''
        });
        setDeliveryFee(0);
        alert("Pedido cancelado com sucesso!");
    } catch (err: any) {
        alert("Erro ao cancelar pedido: " + err.message);
    } finally {
        setIsProcessing(false);
    }
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
        tableNumber: orderType === 'COMANDA' ? commandNumber : undefined,
        items: cart,
        status: isAutoFinalize 
          ? (orderType === 'ENTREGA' ? 'SAIU_PARA_ENTREGA' : 'ENTREGUE') 
          : (orderType === 'ENTREGA' && settings.autoApproveDeliveries) ? 'PRONTO' : 'AGUARDANDO',
        total: total,
        createdAt: Date.now(),
        paymentMethod: isPayOnDelivery ? 'A_PAGAR' as any : (payments.length === 1 ? payments[0].method : 'MISTO' as any),
        paymentDetails: isPayOnDelivery ? '[]' : JSON.stringify(payments),
        waitstaffName: user.name,
        changeFor: change > 0 ? total + change : undefined,
        isSynced: false,
        customerName: (orderType === 'ENTREGA' || orderType === 'BALCAO') ? deliveryDetails.customerName : undefined,
        customerPhone: (orderType === 'ENTREGA' || orderType === 'BALCAO') ? deliveryDetails.customerPhone : undefined,
        deliveryAddress: orderType === 'ENTREGA' ? deliveryDetails.address : undefined,
        originAddress: orderType === 'ENTREGA' ? (deliveryDetails.useStoreOrigin ? settings.address : deliveryDetails.originAddress) : undefined,
        referencePoint: orderType === 'ENTREGA' ? deliveryDetails.referencePoint : undefined,
        deliveryDriverId: orderType === 'ENTREGA' && deliveryDetails.driverId ? deliveryDetails.driverId : undefined,
        session_id: currentSession?.id,
        displayId: Math.floor(1000 + Math.random() * 9000).toString(),
        customerId: selectedCustomer?.id,
        deliveryFee: orderType === 'ENTREGA' ? deliveryFee : undefined
      };

      if (isContingencyMode) {
        const newOrderObj = { ...order, id: `local_${Date.now()}` } as Order;
        const newContingencyList = [...contingencyOrders, newOrderObj];
        setContingencyOrders(newContingencyList);
        localStorage.setItem(`contingency_orders_${storeId}`, JSON.stringify(newContingencyList));
        
        setLastOrder(newOrderObj);
        if (confirm("Venda realizada em MODO CONTINGÊNCIA! Deseja imprimir o cupom?")) {
            printReceipt(newOrderObj);
        }
        
        setCart([]);
        setOriginalCart([]);
        setPayments([]);
        setLoadedCommandIds([]);
        setCommandNumber('');
        setDeliveryDetails({ customerName: '', customerPhone: '', address: '', driverId: '', payOnDelivery: false, useStoreOrigin: true, originAddress: '', referencePoint: '' });
        setDeliveryFee(0);
        setSelectedCustomer(null);
        setCustomerSearchTerm('');
        setIsCheckoutOpen(false);
        setIsProcessing(false);
        return;
      }

      // FIX: Removed .select().single() because insert returns { data, error } directly
      const { data, error } = await supabase.from('orders').insert([order]);
      
      if (error) throw error;
      
      // Se carregamos uma comanda, marcamos os pedidos originais como ENTREGUE
      if (loadedCommandIds.length > 0) {
          for (const id of loadedCommandIds) {
              await supabase
                  .from('orders')
                  .eq('id', id)
                  .update({ status: 'ENTREGUE' });
          }
      }

      // Update stock for all items in the current cart
      const stockUpdates = new Map<string, number>();

      for (const newItem of cart) {
          const current = stockUpdates.get(newItem.productId) || 0;
          stockUpdates.set(newItem.productId, current - newItem.quantity);
      }

      for (const [productId, diff] of stockUpdates.entries()) {
          if (diff !== 0) {
              const product = products.find(p => p.id === productId);
              if (product && product.stock != null) {
                  const newStock = product.stock + diff;
                  const updates: any = { stock: newStock };
                  
                  if (newStock <= 0) {
                      updates.isactive = false;
                  } else {
                      updates.isactive = true;
                  }

                  await supabase
                      .from('products')
                      .eq('id', product.id)
                      .update(updates);
              }
          }
      }

      const newOrder = data ? data[0] : null;
      if (newOrder) {
        setLastOrder(newOrder);
        
        if (settings.isLoyaltyActive && selectedCustomer && selectedCustomer.isLoyaltyParticipant !== false && order.total) {
            const pointsEarned = Math.floor(order.total * (settings.pointsPerCurrencyUnit || 1));
            if (pointsEarned > 0) {
                try {
                    await supabase
                        .from('customers')
                        .eq('id', selectedCustomer.id)
                        .update({ points: (selectedCustomer.points || 0) + pointsEarned });
                } catch (e) {
                    console.error("Erro ao atualizar pontos do cliente:", e);
                }
            }
        }

        // Auto print or show print option
        if (confirm("Venda realizada! Deseja imprimir o cupom?")) {
            printReceipt(newOrder);
        }
      }

      setCart([]);
      setOriginalCart([]);
      setPayments([]);
      setLoadedCommandIds([]);
      setCommandNumber('');
      setDeliveryDetails({ customerName: '', customerPhone: '', address: '', driverId: '', payOnDelivery: false, useStoreOrigin: true, originAddress: '', referencePoint: '' });
      setDeliveryFee(0);
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      setIsCheckoutOpen(false);
      fetchProducts(); // Refresh stock
      
    } catch (err: any) {
      alert("Erro ao finalizar venda: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBleed = async () => {
      if (isContingencyMode) {
          alert("A sangria não está disponível no Modo Contingência.");
          return;
      }
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
    if (isContingencyMode || contingencyOrders.length > 0) {
        alert("Sincronize os pedidos e desative o Modo Contingência antes de fechar o caixa.");
        return;
    }
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

      const bleedsTotal = movements.reduce((acc, m) => acc + (m.amount || 0), 0);

      const sales = (orders as Order[] || []).reduce((acc, order) => {
        if (order.status === 'CANCELADO') return acc;
        
        let orderPayments: Payment[] = [];
        if (order.paymentDetails) {
            try { orderPayments = JSON.parse(order.paymentDetails); } catch(e) {}
        } else if (order.paymentMethod) {
            orderPayments = [{ method: order.paymentMethod, amount: order.total || 0 }];
        }

        if (orderPayments.length === 0) {
            if (order.paymentMethod === 'A_PAGAR' as any && order.status === 'ENTREGUE') {
                orderPayments = [{ method: 'A_PAGAR' as any, amount: order.total || 0 }];
            } else {
                return acc;
            }
        }

        const orderTotal = order.total || 0;
        acc.total += orderTotal;
        acc.count += 1;

        orderPayments.forEach(p => {
            if (p && p.method) {
                acc.byMethod[p.method] = (acc.byMethod[p.method] || 0) + (p.amount || 0);
            }
        });

        (order.items || []).forEach(item => {
            const existing = acc.products.find(p => p.productId === item.productId);
            if (existing) {
                existing.quantity += item.quantity;
                existing.total += item.price * item.quantity;
            } else {
                acc.products.push({
                    productId: item.productId,
                    name: item.name,
                    quantity: item.quantity,
                    total: item.price * item.quantity,
                    isByWeight: item.isByWeight
                });
            }
        });

        return acc;
      }, { total: 0, byMethod: {} as Record<string, number>, count: 0, bleeds: bleedsTotal, products: [] as any[] });
      
      setDailySales(sales);
    } catch (err) {
      console.error(err);
      setDailySales({ total: 0, byMethod: {}, count: 0, bleeds: 0, products: [] });
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

  const printReceipt = async (order: Order) => {
    if (settings.usbPrinterVendorId && settings.usbPrinterProductId) {
      try {
        const removeAccents = (str: string) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        let text = "";
        text += removeAccents(settings.storeName).toUpperCase() + "\n";
        if (settings.cnpj) {
          text += `CNPJ: ${settings.cnpj}\n`;
        }
        text += `Data: ${new Date(order.createdAt).toLocaleString()}\n`;
        text += `Pedido: #${order.displayId || String(order.id || '').slice(0, 8)}\n`;
        text += `Cliente: ${removeAccents(order.customerName || 'Consumidor')}\n`;
        text += "--------------------------------\n";
        
        order.items.forEach((item: any) => {
          const line = `${item.quantity}x ${removeAccents(item.name).substring(0, 20)}`;
          const price = formatCurrency(item.price * item.quantity);
          const spaces = Math.max(1, 32 - line.length - price.length);
          text += line + " ".repeat(spaces) + price + "\n";
        });
        
        text += "--------------------------------\n";
        if (order.deliveryFee && order.deliveryFee > 0) {
          const feeText = "Taxa de Entrega";
          const feeVal = formatCurrency(order.deliveryFee);
          const spacesFee = Math.max(1, 32 - feeText.length - feeVal.length);
          text += feeText + " ".repeat(spacesFee) + feeVal + "\n";
        }
        const totalText = "TOTAL";
        const totalVal = formatCurrency(order.total);
        const spacesTotal = Math.max(1, 32 - totalText.length - totalVal.length);
        text += totalText + " ".repeat(spacesTotal) + totalVal + "\n";
        
        text += `Pagamento: ${removeAccents(order.paymentMethod || '')}\n`;
        if (order.changeFor) {
          text += `Troco para: ${formatCurrency(order.changeFor)}\n`;
        }
        text += "\nObrigado pela preferencia!\n\n\n\n";

        const devices = await (navigator as any).usb.getDevices();
        const device = devices.find((d: any) => d.vendorId === settings.usbPrinterVendorId && d.productId === settings.usbPrinterProductId);
        
        if (device) {
          await device.open();
          if (device.configuration === null) {
            await device.selectConfiguration(1);
          }
          await device.claimInterface(0);

          const encoder = new TextEncoder();
          const data = encoder.encode(text);
          
          const init = new Uint8Array([0x1B, 0x40]); 
          const cut = new Uint8Array([0x1D, 0x56, 0x41, 0x10]); 

          let outEndpoint;
          for (const endpoint of device.configuration.interfaces[0].alternate.endpoints) {
            if (endpoint.direction === 'out') {
              outEndpoint = endpoint;
              break;
            }
          }

          if (outEndpoint) {
            await device.transferOut(outEndpoint.endpointNumber, init);
            await device.transferOut(outEndpoint.endpointNumber, data);
            await device.transferOut(outEndpoint.endpointNumber, cut);
            await device.close();
            return; // Success
          }
        } else {
          console.warn("Impressora USB não encontrada. Tentando impressão padrão.");
        }
      } catch (error) {
        console.error("Erro na impressão USB:", error);
      }
    }

    const content = `
      <div style="font-family: monospace; width: 300px; font-size: 12px;">
        <h2 style="text-align: center; margin: 0;">${settings.storeName}</h2>
        ${settings.cnpj ? `<p style="text-align: center; margin: 0 0 10px 0;">CNPJ: ${settings.cnpj}</p>` : ''}
        <p>Data: ${new Date(order.createdAt).toLocaleString()}</p>
        <p>Pedido: #${order.displayId || String(order.id || '').slice(0, 8)}</p>
        <p>Cliente: ${order.customerName || 'Consumidor'}</p>
        <hr />
        ${order.items.map((item: any) => `
          <div style="display: flex; justify-content: space-between;">
            <span>${item.quantity}x ${item.name}</span>
            <span>${formatCurrency(item.price * item.quantity)}</span>
          </div>
        `).join('')}
        <hr />
        ${order.deliveryFee && order.deliveryFee > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Taxa de Entrega</span>
          <span>${formatCurrency(order.deliveryFee)}</span>
        </div>
        <hr />
        ` : ''}
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
                <span>${formatCurrency(amount as number)}</span>
            </div>
        `).join('')}
        <hr />
        <p><strong>Produtos Vendidos:</strong></p>
        ${dailySales.products.sort((a, b) => b.total - a.total).map(p => `
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
                <span style="width: 50px; text-align: right;">${p.isByWeight ? p.quantity.toFixed(3) + 'kg' : p.quantity + 'x'}</span>
                <span style="width: 70px; text-align: right;">${formatCurrency(p.total)}</span>
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
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-gray-100 overflow-hidden font-sans text-gray-900">
      {/* Left Side - Products */}
      <div className="flex-1 flex flex-col min-w-0 h-[55dvh] lg:h-full">
        <header 
          className="p-3 md:p-4 shadow-sm flex flex-col md:flex-row justify-between items-center z-10 gap-3 transition-colors"
          style={{ backgroundColor: settings.primaryColor || '#ffffff' }}
        >
          <div className="flex justify-between w-full md:w-auto items-center gap-3">
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="h-10 w-10 md:h-12 md:w-12 object-contain rounded-full bg-white/10 p-1" />
            )}
            <div>
              <h1 className="text-lg md:text-xl font-bold" style={{ color: settings.primaryColor ? '#ffffff' : '#1f2937' }}>
                PDV - {settings.storeName}
              </h1>
              <p className="text-[10px] md:text-xs" style={{ color: settings.primaryColor ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>
                Operador: {user.name}
              </p>
            </div>
            <button onClick={onLogout} className="md:hidden p-2 hover:bg-white/10 rounded-full" style={{ color: settings.primaryColor ? '#ffffff' : '#ef4444' }}>
                <LogOut size={20} />
            </button>
          </div>
          <div className="flex gap-1 md:gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
             <button onClick={connectScale} className={`p-2 rounded-xl flex items-center gap-2 px-3 md:px-4 border shrink-0 ${isScaleConnected ? 'text-blue-600 border-blue-100 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`} 
                style={{ 
                    color: !isScaleConnected ? (settings.primaryColor ? 'rgba(255,255,255,0.7)' : '#9ca3af') : undefined,
                    borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                    backgroundColor: settings.primaryColor && !isScaleConnected ? 'rgba(255,255,255,0.1)' : undefined
                }}
                title={isScaleConnected ? "Balança Conectada" : "Conectar Balança"}>
                <div className="relative">
                    <Package size={18} />
                    {isScaleConnected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                </div>
                <span className="text-xs font-bold">{scaleWeight ? `${scaleWeight.toFixed(3)}kg` : 'Balança'}</span>
             </button>
             <button onClick={() => setIsBleedModalOpen(true)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl flex items-center gap-2 px-3 md:px-4 border border-orange-100 shrink-0" 
                style={{ 
                    color: settings.primaryColor ? '#ffffff' : undefined,
                    borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                    backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                }}
                title="Sangria">
                <Minus size={18} />
                <span className="text-xs font-bold">Sangria</span>
             </button>
             <button onClick={handleCloseRegister} className="p-2 text-green-600 hover:bg-green-50 rounded-xl flex items-center gap-2 px-3 md:px-4 border border-green-100 shrink-0" 
                style={{ 
                    color: settings.primaryColor ? '#ffffff' : undefined,
                    borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                    backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                }}
                title="Fechar Caixa">
                <DollarSign size={18} />
                <span className="text-xs font-bold">Fechar Caixa</span>
             </button>
             <button onClick={() => window.location.reload()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl border border-gray-100 shrink-0" 
                style={{ 
                    color: settings.primaryColor ? '#ffffff' : undefined,
                    borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                    backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                }}
                title="Atualizar">
                <RefreshCw size={18} />
             </button>
             <button 
                onClick={() => setIsContingencyMode(!isContingencyMode)} 
                className={`p-2 rounded-xl flex items-center gap-2 px-3 md:px-4 border shrink-0 ${isContingencyMode ? 'text-orange-600 border-orange-100 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`} 
                style={{ 
                    color: !isContingencyMode ? (settings.primaryColor ? 'rgba(255,255,255,0.7)' : '#9ca3af') : undefined,
                    borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                    backgroundColor: settings.primaryColor && !isContingencyMode ? 'rgba(255,255,255,0.1)' : undefined
                }}
                title={isContingencyMode ? "Modo Contingência Ativo" : "Ativar Modo Contingência"}
             >
                {isContingencyMode ? <WifiOff size={18} /> : <Wifi size={18} />}
                <span className="text-xs font-bold hidden md:inline">{isContingencyMode ? 'Contingência' : 'Online'}</span>
             </button>
             {contingencyOrders.length > 0 && (
                <button 
                  onClick={syncContingencyOrders} 
                  disabled={isProcessing}
                  className="p-2 text-white bg-orange-500 hover:bg-orange-600 rounded-xl flex items-center gap-2 px-3 md:px-4 border border-orange-600 shrink-0 shadow-lg animate-pulse" 
                  title="Sincronizar Pedidos"
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                  <span className="text-xs font-bold hidden md:inline">Sincronizar ({contingencyOrders.length})</span>
                </button>
             )}
             <InstallPrompt />
             {lastOrder && (
               <button onClick={() => printReceipt(lastOrder)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl border border-blue-100 shrink-0" 
                style={{ 
                    color: settings.primaryColor ? '#ffffff' : undefined,
                    borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                    backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                }}
                title="Reimprimir Último Cupom">
                  <Printer size={18} />
               </button>
             )}
             <button onClick={onLogout} className="hidden md:flex p-2 text-red-500 hover:bg-red-50 rounded-xl border border-red-100 shrink-0" 
                style={{ 
                    color: settings.primaryColor ? '#ffffff' : undefined,
                    borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                    backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                }}
                title="Sair">
                <LogOut size={18} />
             </button>
          </div>
        </header>
        
        {/* ... (rest of the component) */}

        <div className="p-2 md:p-4 bg-white border-b flex gap-2 md:gap-4 overflow-x-auto no-scrollbar shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat 
                  ? 'text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={{
                backgroundColor: selectedCategory === cat ? (settings.primaryColor || '#2563eb') : undefined
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="p-2 md:p-4 flex-1 overflow-y-auto bg-gray-50">
          <div className="mb-3 md:mb-6 relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar produto..."
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
                className="w-full pl-10 md:pl-12 pr-4 py-2 md:py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                autoFocus
              />
            </div>
            <button 
              type="button" 
              onClick={() => setShowScanner(!showScanner)} 
              className="p-2 md:p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center shadow-sm" 
              title="Ler com a câmera"
            >
              <ScanLine size={20} />
            </button>
            <label className="p-2 md:p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center cursor-pointer shadow-sm" title="Ler de uma imagem">
              <Camera size={20} />
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const html5QrCode = new Html5Qrcode("pos-reader");
                    try {
                      const decodedText = await html5QrCode.scanFile(file, true);
                      setSearch(decodedText);
                      const exactMatch = products.find(p => p.barcode === decodedText);
                      if (exactMatch) {
                        handleProductClick(exactMatch);
                        setSearch('');
                      }
                      alert("Código lido com sucesso!");
                    } catch (err) {
                      alert("Não foi possível ler o código na imagem.");
                    }
                  }
                }} 
              />
            </label>
          </div>

          {showScanner && (
            <div className="mb-4 bg-black rounded-xl overflow-hidden relative">
              <div id="pos-reader" className="w-full"></div>
              <button 
                onClick={() => setShowScanner(false)}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
              >
                <X size={20} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
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
                  {product.stock != null && (
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
                <h3 className="font-bold text-gray-800 text-sm line-clamp-2 mb-1 group-hover:text-blue-600" style={{ color: settings.primaryColor ? undefined : undefined }}>{product.name}</h3>
                <div className="mt-auto flex justify-between items-end">
                  <span className="font-black text-lg text-gray-900">{formatCurrency(product.price)}</span>
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ 
                        backgroundColor: settings.primaryColor ? `${settings.primaryColor}20` : '#eff6ff',
                        color: settings.primaryColor || '#2563eb'
                    }}
                  >
                    <Plus size={16} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-full lg:w-96 bg-white shadow-xl flex flex-col border-t lg:border-l border-gray-200 z-20 h-[45dvh] lg:h-full">
        <div className="p-3 border-b bg-gray-50 flex justify-between items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">Carrinho</span>
          </h2>
          <div className="flex gap-2 shrink-0">
              {cart.length > 0 && (
                  <button 
                    onClick={() => {
                        if (confirm("Limpar carrinho?")) {
                            setCart([]);
                            setOriginalCart([]);
                            setLoadedCommandIds([]);
                            setCommandNumber('');
                        }
                    }}
                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                    title="Limpar Carrinho"
                  >
                    <Trash2 size={16} />
                  </button>
              )}
              <button 
                onClick={() => {
                    const num = prompt("Digite o número da comanda:");
                    if (num) lookupCommand(num, 'COMANDA');
                }}
                disabled={isLookingUpCommand}
                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 text-xs font-bold whitespace-nowrap"
                style={{
                    backgroundColor: settings.primaryColor ? `${settings.primaryColor}20` : undefined,
                    color: settings.primaryColor || undefined
                }}
              >
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <Tag size={16} />}
                <span className="hidden sm:inline">Comanda</span>
              </button>
              <button 
                onClick={() => {
                    const num = prompt("Digite o número da mesa:");
                    if (num) lookupCommand(num, 'MESA');
                }}
                disabled={isLookingUpCommand}
                className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-1 text-xs font-bold whitespace-nowrap"
              >
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <Hash size={16} />}
                <span className="hidden sm:inline">Mesa</span>
              </button>
              <button 
                onClick={() => lookupOrdersList('ENTREGA')}
                disabled={isLookingUpCommand}
                className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1 text-xs font-bold whitespace-nowrap"
              >
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                <span className="hidden sm:inline">Entrega</span>
              </button>
              <button 
                onClick={() => lookupOrdersList('BALCAO')}
                disabled={isLookingUpCommand}
                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 text-xs font-bold whitespace-nowrap"
              >
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <ShoppingBag size={16} />}
                <span className="hidden sm:inline">Balcão</span>
              </button>
          </div>
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

        <div className="p-4 md:p-6 bg-gray-50 border-t space-y-3 md:space-y-4 shrink-0">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
                <span className="text-gray-500 font-medium text-sm md:text-base">Total a Pagar</span>
                {loadedCommandIds.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                        <Tag size={10} /> Comanda {commandNumber}
                    </span>
                )}
            </div>
            <span className="text-2xl md:text-3xl font-black text-gray-900">{formatCurrency(total)}</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 w-full sm:w-auto flex-1">
                {loadedCommandIds.length > 0 && (
                    <button 
                        onClick={handleCancelOrder}
                        disabled={isProcessing}
                        className="flex-1 py-3 md:py-4 bg-red-500 text-white rounded-xl font-bold text-sm md:text-lg shadow-lg hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 md:gap-2"
                    >
                        <X size={20} />
                        <span className="hidden sm:inline">Cancelar</span>
                    </button>
                )}
                {cart.length > 0 && (
                    <button 
                        onClick={handleSaveToCommand}
                        disabled={isProcessing}
                        className="flex-1 py-3 md:py-4 bg-blue-600 text-white rounded-xl font-bold text-sm md:text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 md:gap-2"
                        style={{ backgroundColor: settings.primaryColor || '#2563eb' }}
                    >
                        <Tag size={20} />
                        Lançar
                    </button>
                )}
            </div>
            <button 
                onClick={() => {
                    setIsCheckoutOpen(true);
                    setPayments([]);
                    setCurrentPaymentAmount(total.toFixed(2));
                }}
                disabled={cart.length === 0}
                className="w-full sm:flex-[2] py-3 md:py-4 bg-green-600 text-white rounded-xl font-bold text-sm md:text-lg shadow-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 md:gap-2"
            >
                <CheckCircle2 size={20} />
                {loadedCommandIds.length > 0 ? `Finalizar Comanda ${commandNumber}` : 'Finalizar Venda'}
            </button>
          </div>
        </div>
      </div>

      {/* Weight Modal */}
      {weightModal.isOpen && weightModal.product && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">Informe o Peso (Gramas)</h3>
            {isScaleConnected && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    Lendo da balança...
                </div>
            )}
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
                <button 
                    onClick={() => setOrderType('COMANDA')}
                    className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider ${orderType === 'COMANDA' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400'}`}
                >
                    Comanda
                </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <input 
                      type="checkbox" 
                      id="autoFinalize"
                      checked={isAutoFinalize}
                      onChange={e => setIsAutoFinalize(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="autoFinalize" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                      Finalizar Automaticamente (Marcar como Entregue)
                  </label>
              </div>

              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-gray-500 uppercase">Vincular Cliente (Opcional)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.points} pts)` : customerSearchTerm}
                    onChange={e => {
                      setCustomerSearchTerm(e.target.value);
                      setSelectedCustomer(null);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-10 pr-10 p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none"
                    placeholder="Buscar cliente por nome ou telefone..."
                  />
                  {selectedCustomer && (
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {showCustomerDropdown && !selectedCustomer && customerSearchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {customers
                        .filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || c.phone.includes(customerSearchTerm))
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearchTerm('');
                              setShowCustomerDropdown(false);
                              if (orderType === 'ENTREGA' || orderType === 'BALCAO') {
                                setDeliveryDetails(prev => ({
                                  ...prev,
                                  customerName: c.name,
                                  customerPhone: c.phone
                                }));
                              }
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex justify-between items-center"
                          >
                            <div>
                              <div className="font-bold text-gray-800">{c.name}</div>
                              <div className="text-xs text-gray-500">{c.phone}</div>
                            </div>
                            <div className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                              {c.points} pts
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {orderType === 'COMANDA' && (
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-4">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-blue-700 uppercase">Número da Comanda</label>
                          <div className="relative">
                              <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="number" 
                                  value={commandNumber}
                                  onChange={e => setCommandNumber(e.target.value)}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none text-lg font-bold"
                                  placeholder="000"
                                  autoFocus
                              />
                          </div>
                      </div>
                  </div>
              )}

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
                          <label className="text-xs font-bold text-blue-700 uppercase">Endereço de Destino</label>
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
                      
                      <div className="space-y-1 md:col-span-2 bg-white p-3 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-2 mb-2">
                              <input 
                                  type="checkbox" 
                                  id="useStoreOrigin"
                                  checked={deliveryDetails.useStoreOrigin}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, useStoreOrigin: e.target.checked})}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                              />
                              <label htmlFor="useStoreOrigin" className="text-xs font-bold text-blue-800 cursor-pointer">
                                  Origem é o endereço da loja
                              </label>
                          </div>
                          
                          {!deliveryDetails.useStoreOrigin && (
                              <div className="relative mt-2">
                                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                                  <input 
                                      type="text" 
                                      value={deliveryDetails.originAddress}
                                      onChange={e => setDeliveryDetails({...deliveryDetails, originAddress: e.target.value})}
                                      className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                      placeholder="Endereço de origem"
                                  />
                              </div>
                          )}
                      </div>

                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Ponto de Referência</label>
                          <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.referencePoint}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, referencePoint: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="Ponto de referência"
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

                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Taxa de Entrega (R$)</label>
                          <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="number" 
                                  step="0.01"
                                  min="0"
                                  value={deliveryFee || ''}
                                  onChange={e => {
                                      const val = parseFloat(e.target.value);
                                      setDeliveryFee(isNaN(val) ? 0 : val);
                                  }}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="0.00"
                              />
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
                                          <option value="DEBITO">Débito</option>
                                          <option value="VALES">Vales</option>
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
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col items-center gap-4 text-center">
                          {settings.pixQrCodeUrl ? (
                            <img src={settings.pixQrCodeUrl} alt="QR Pix" className="w-48 h-48 object-contain mix-blend-multiply bg-white p-2 rounded-xl shadow-sm" />
                          ) : (
                            <QrCode size={48} className="text-gray-400" />
                          )}
                          <div className="flex-1">
                              <p className="text-sm font-bold text-gray-700">QR Code Pix</p>
                              <p className="text-xs text-gray-500">Escaneie para pagar</p>
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
                                          {p.method === 'DEBITO' && <CreditCard size={16} className="text-blue-400" />}
                                          {p.method === 'VALES' && <Ticket size={16} className="text-orange-600" />}
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

      {/* Delivery/Counter Orders Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex flex-col gap-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    {lookupType === 'ENTREGA' ? <Truck size={24} className="text-purple-600" /> : <ShoppingBag size={24} className="text-blue-600" />}
                    {lookupType === 'ENTREGA' ? 'Entregas Pendentes' : 'Pedidos Balcão Pendentes'}
                </h2>
                <button onClick={() => setShowDeliveryModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={24} />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por código (#1234) ou nome..." 
                    value={deliverySearchTerm}
                    onChange={(e) => setDeliverySearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
                    autoFocus
                />
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {deliveryOrdersList.filter(o => {
                    if (!deliverySearchTerm) return true;
                    const term = deliverySearchTerm.toLowerCase();
                    return (
                        (o.displayId && String(o.displayId).includes(term)) || 
                        (o.customerName && o.customerName.toLowerCase().includes(term)) ||
                        (o.id && String(o.id).includes(term))
                    );
                }).length === 0 ? (
                    <p className="text-center text-gray-500 py-10">Nenhum pedido encontrado.</p>
                ) : (
                    deliveryOrdersList
                    .filter(o => {
                        if (!deliverySearchTerm) return true;
                        const term = deliverySearchTerm.toLowerCase();
                        return (
                            (o.displayId && String(o.displayId).includes(term)) || 
                            (o.customerName && o.customerName.toLowerCase().includes(term)) ||
                            (o.id && String(o.id).includes(term))
                        );
                    })
                    .map(order => (
                        <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${order.type === 'ENTREGA' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        #{order.displayId || String(order.id || '').slice(0,8)}
                                    </span>
                                    <span className="text-xs text-gray-400 font-bold">
                                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '--:--'}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gray-100 text-gray-600">
                                        {order.status.replace(/_/g, ' ')}
                                    </span>
                                    {order.deliveryDriverId && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-yellow-100 text-yellow-700 flex items-center gap-1">
                                            <Truck size={10} />
                                            {couriers.find(c => c.id === order.deliveryDriverId)?.name || 'Entregador'}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-gray-800">{order.customerName || 'Cliente sem nome'}</h3>
                                {order.type === 'ENTREGA' && (
                                  <>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <Phone size={12} /> {order.customerPhone || 'Sem telefone'}
                                    </p>
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                        <MapPin size={12} /> {order.deliveryAddress || 'Retirada'}
                                    </p>
                                    {order.referencePoint && (
                                        <p className="text-xs text-gray-400 italic mt-1 ml-4">
                                            Ref: {order.referencePoint}
                                        </p>
                                    )}
                                  </>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(order.items || []).slice(0, 3).map((item, idx) => (
                                        item ? (
                                            <span key={idx} className="bg-gray-50 text-gray-600 px-2 py-1 rounded text-xs font-medium border border-gray-100">
                                                {item.quantity}x {item.name}
                                            </span>
                                        ) : null
                                    ))}
                                    {(order.items || []).length > 3 && (
                                        <span className="text-xs text-gray-400 self-center">+{order.items.length - 3} itens</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end justify-between gap-4 min-w-[120px]">
                                <span className="text-xl font-black text-gray-900">{formatCurrency(order.total || 0)}</span>
                                <div className="flex flex-col gap-2 w-full">
                                    <button 
                                        onClick={() => loadOrderFromList(order)}
                                        className={`w-full py-2 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${order.type === 'ENTREGA' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        <CheckCircle2 size={16} />
                                        Selecionar
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if(window.confirm('Tem certeza que deseja cancelar este pedido?')) {
                                                try {
                                                    await supabase
                                                        .from('orders')
                                                        .eq('id', order.id)
                                                        .update({ status: 'CANCELADO' });
                                                        
                                                    // Refresh the list
                                                    lookupOrdersList(lookupType);
                                                } catch (err) {
                                                    console.error("Erro ao cancelar pedido:", err);
                                                    alert("Erro ao cancelar pedido.");
                                                }
                                            }
                                        }}
                                        className="w-full py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <X size={16} />
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
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
                                    <span className="font-bold">{formatCurrency(amount as number)}</span>
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
