
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  X, 
  ChevronLeft, 
  Plus as PlusIcon, 
  Minus as MinusIcon, 
  CheckCircle, 
  Loader2, 
  Search, 
  MapPin, 
  ExternalLink, 
  Send, 
  Flame, 
  Utensils, 
  ShoppingBag, 
  Truck, 
  MessageCircle, 
  Store, 
  Scale,
  AlertTriangle,
  Power,
  Info,
  Phone,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Tag,
  Check,
  Wallet,
  CreditCard,
  Banknote,
  DollarSign,
  Hash,
  UserRound,
  ArrowLeft
} from 'lucide-react';
import { Product, StoreSettings, Order, OrderItem, OrderType, PaymentMethod, Waitstaff } from '../types';

interface Props {
  products: Product[];
  categories: string[];
  settings: StoreSettings;
  orders: Order[];
  addOrder: (order: Order) => Promise<void>;
  tableNumber: string | null;
  onLogout: () => void;
  onCloseMenu?: () => void;
  isWaitstaff?: boolean;
}

const DigitalMenu: React.FC<Props> = ({ products, categories: externalCategories, settings, addOrder, tableNumber: initialTable, onLogout, onCloseMenu, isWaitstaff: initialIsWaitstaff = false }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTable = searchParams.get('mesa');
  const urlType = searchParams.get('tipo');
  const storeSlug = searchParams.get('loja');
  
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'success'>('cart');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);
  const [selectedWeightGrams, setSelectedWeightGrams] = useState<string>("");

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{code: string, discount: number} | null>(null);

  const effectiveTable = initialTable || urlTable || null;
  const isStoreClosed = settings.isStoreOpen === false;

  const [isWaitstaff, setIsWaitstaff] = useState(initialIsWaitstaff || !!localStorage.getItem('gc-conveniencia-session-v1'));

  const [hasSelectedMode, setHasSelectedMode] = useState(() => {
    if (urlType && ['BALCAO', 'ENTREGA', 'MESA', 'COMANDA'].includes(urlType)) return true;
    if (isWaitstaff) return true;
    if (effectiveTable && settings.isTableOrderActive) return true;
    return false;
  });
  
  const [orderType, setOrderType] = useState<OrderType>(() => {
    if (urlType === 'BALCAO' && settings.isCounterPickupActive) return 'BALCAO';
    if (urlType === 'ENTREGA' && settings.isDeliveryActive) return 'ENTREGA';
    if (urlType === 'COMANDA') return 'COMANDA';
    if (effectiveTable && settings.isTableOrderActive) return 'MESA';
    return isWaitstaff ? 'MESA' : 'BALCAO';
  });

  useEffect(() => {
    if (isWaitstaff && !urlType && !effectiveTable && orderType === 'BALCAO') {
        setOrderType('MESA');
    }
  }, [isWaitstaff, urlType, effectiveTable, orderType]);

  const handleResetMode = () => {
    if (urlType || effectiveTable) return; // Don't reset if locked by URL
    setHasSelectedMode(false);
    setCheckoutStep('cart');
    setIsCartOpen(false);
  };

  const [manualTable, setManualTable] = useState(effectiveTable || '');
  const [payment, setPayment] = useState<PaymentMethod>('PIX');
  const [changeFor, setChangeFor] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  
  const [activeWaitstaff, setActiveWaitstaff] = useState<Waitstaff | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gc-conveniencia-session-v1');
    if (saved) {
        const parsed = JSON.parse(saved);
        setActiveWaitstaff(parsed);
        setIsWaitstaff(true);
    }
  }, []);

  const categories = useMemo(() => ['Todos', ...externalCategories], [externalCategories]);
  
  const featuredProduct = useMemo(() => {
    const today = new Date().getDay();
    return products.find(p => p.featuredDay === today && p.isActive);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (p.barcode && p.barcode.includes(searchTerm));
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchTerm]);

  const handleBack = () => {
    if (onCloseMenu) {
      onCloseMenu();
      return;
    }
    
    // Se for atendente, força a volta para o painel de mesas garantindo o slug
    if (isWaitstaff) {
      const lojaParam = storeSlug ? `?loja=${storeSlug}` : '';
      navigate(`/atendimento${lojaParam}`);
      return;
    }

    setHasSelectedMode(false);
  };

  const handleAddToCart = (product: Product) => {
    if (!product.isActive) return;
    if (product.isByWeight) {
      setWeightProduct(product);
      setSelectedWeightGrams("");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        description: product.description,
        price: product.price, 
        quantity: 1, 
        isByWeight: false
      }];
    });
  };

  const confirmWeightAddition = () => {
    if (!weightProduct || !selectedWeightGrams) return;
    const grams = parseFloat(selectedWeightGrams.replace(',', '.'));
    if (isNaN(grams) || grams <= 0) {
      alert("Por favor, informe um peso válido em gramas.");
      return;
    }
    const quantityKg = grams / 1000;
    const productToAdd = { ...weightProduct };
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.productId === productToAdd.id);
      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex] = { 
          ...newCart[existingIndex], 
          quantity: newCart[existingIndex].quantity + quantityKg 
        };
        return newCart;
      }
      return [...prev, { 
        productId: productToAdd.id, 
        name: productToAdd.name, 
        description: productToAdd.description,
        price: productToAdd.price, 
        quantity: quantityKg, 
        isByWeight: true
      }];
    });
    setWeightProduct(null);
    setSelectedWeightGrams("");
  };

  const updateCartItemQuantity = (productId: string, delta: number) => {
    setCart(prev => {
        return prev.map(item => {
            if (item.productId === productId) {
                const step = item.isByWeight ? 0.050 : 1;
                const newQty = item.quantity + (delta * step);
                return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
        }).filter(Boolean) as OrderItem[];
    });
  };

  const { subtotal, discountAmount, cartTotal, isAnyItemEligibleForCoupon } = useMemo(() => {
    const sub = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    let disc = 0;
    const eligibleIds = settings.applicableProductIds || [];
    const eligibleItems = cart.filter(item => settings.isCouponForAllProducts || eligibleIds.includes(item.productId));
    const anyEligible = eligibleItems.length > 0;

    if (appliedCoupon) {
      if (settings.isCouponForAllProducts !== false) {
        disc = sub * (appliedCoupon.discount / 100);
      } else {
        const eligibleSubtotal = cart.reduce((acc, item) => {
           return eligibleIds.includes(item.productId) ? acc + (item.price * item.quantity) : acc;
        }, 0);
        disc = eligibleSubtotal * (appliedCoupon.discount / 100);
      }
    }
    return { subtotal: sub, discountAmount: disc, cartTotal: Math.max(0, sub - disc), isAnyItemEligibleForCoupon: anyEligible };
  }, [cart, appliedCoupon, settings]);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    if (settings.isCouponActive && couponCode.toUpperCase() === settings.couponName?.toUpperCase()) {
      if (settings.isCouponForAllProducts === false && !isAnyItemEligibleForCoupon) {
          alert("Este cupom não é válido para nenhum dos produtos selecionados.");
          return;
      }
      setAppliedCoupon({ code: settings.couponName!, discount: settings.couponDiscount || 0 });
      setCouponCode('');
    } else {
      alert("Cupom inválido ou expirado.");
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if ((orderType === 'MESA' || orderType === 'COMANDA') && !manualTable) { alert(`Informe o número da ${orderType === 'MESA' ? 'mesa' : 'comanda'}.`); return; }
    if (orderType === 'BALCAO' && !customerName && !isWaitstaff) { alert('Informe o seu nome.'); return; }
    if (orderType === 'ENTREGA' && (!customerName || !customerPhone || !deliveryAddress)) { alert('Preencha os dados de entrega.'); return; }

    setIsSending(true);
    const orderChangeFor = (payment === 'DINHEIRO' && changeFor) ? parseFloat(changeFor.replace(',', '.')) : undefined;

    const finalOrder: Order = {
      id: Date.now().toString(), 
      type: orderType, 
      items: cart, 
      status: 'PREPARANDO', 
      total: cartTotal, 
      createdAt: Date.now(), 
      paymentMethod: payment,
      changeFor: orderChangeFor,
      notes: notes.trim() || undefined, 
      tableNumber: (orderType === 'MESA' || orderType === 'COMANDA') ? manualTable : undefined,
      customerName: customerName.trim() || (isWaitstaff ? `Atend: ${activeWaitstaff?.name}` : undefined), 
      customerPhone: customerPhone.trim() || undefined,
      deliveryAddress: orderType === 'ENTREGA' ? deliveryAddress.trim() : undefined,
      waitstaffName: activeWaitstaff?.name || undefined,
      couponApplied: appliedCoupon?.code || undefined,
      discountAmount: discountAmount || undefined
    };

    try { 
      await addOrder(finalOrder); 
      setCart([]); 
      setAppliedCoupon(null);
      setCheckoutStep('success'); 
    } catch (err: any) { 
      alert(`Erro ao enviar pedido: ${err.message}`); 
    } finally { 
      setIsSending(false); 
    }
  };

  if (!hasSelectedMode && !isWaitstaff) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-zinc-900">
        <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-10 border border-orange-100 animate-scale-up relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary opacity-10 rounded-full blur-3xl"></div>
          <div className="text-center relative z-10">
            <div className="relative inline-block mb-6">
                <img src={settings.logoUrl} className="w-24 h-24 rounded-full border-4 border-orange-50 object-cover shadow-2xl" alt="Logo" />
                {!isStoreClosed && <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white"></div>}
            </div>
            <h1 className="text-2xl font-brand font-bold text-primary leading-tight">Olá! Seja bem-vindo.</h1>
            <p className="text-xs text-gray-400 mt-2 uppercase tracking-[0.2em] font-black">{isStoreClosed ? 'ESTAMOS FECHADOS NO MOMENTO' : 'Como deseja fazer seu pedido?'}</p>
          </div>
          {isStoreClosed ? (
            <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100 text-center space-y-4">
               <Power size={56} className="text-red-300 mx-auto" strokeWidth={1.5} />
               <p className="text-sm font-bold text-red-700 leading-relaxed uppercase">Nossa loja física e digital estão pausadas agora. Voltaremos em breve!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
                {settings.isTableOrderActive && (
                  <button onClick={() => { setOrderType('MESA'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-orange-50/50 hover:bg-orange-100/50 rounded-[1.8rem] transition-all border border-orange-100 active:scale-95 text-left">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-white rounded-2xl text-orange-600 shadow-sm transition-transform group-hover:scale-110"><Utensils size={28} /></div>
                          <div>
                            <p className="font-bold text-lg text-primary leading-none">Na Mesa</p>
                            <p className="text-[10px] text-orange-700 opacity-60 font-black uppercase mt-1 tracking-wider">Estou no salão</p>
                          </div>
                      </div>
                      <ArrowRight className="text-orange-200 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" size={20} />
                  </button>
                )}
                <button onClick={() => { setOrderType('COMANDA'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-purple-50/50 hover:bg-purple-100/50 rounded-[1.8rem] transition-all border border-purple-100 active:scale-95 text-left">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-white rounded-2xl text-purple-600 shadow-sm transition-transform group-hover:scale-110"><Tag size={28} /></div>
                        <div>
                          <p className="font-bold text-lg text-primary leading-none">Comanda</p>
                          <p className="text-[10px] text-purple-700 opacity-60 font-black uppercase mt-1 tracking-wider">Tenho uma comanda</p>
                        </div>
                    </div>
                    <ArrowRight className="text-purple-200 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" size={20} />
                </button>
                {settings.isCounterPickupActive && (
                  <button onClick={() => { setOrderType('BALCAO'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-blue-50/50 hover:bg-blue-100/50 rounded-[1.8rem] transition-all border border-blue-100 active:scale-95 text-left">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-white rounded-2xl text-blue-600 shadow-sm transition-transform group-hover:scale-110"><ShoppingBag size={28} /></div>
                          <div>
                            <p className="font-bold text-lg text-primary leading-none">Balcão</p>
                            <p className="text-[10px] text-blue-700 opacity-60 font-black uppercase mt-1 tracking-wider">Vou retirar aqui</p>
                          </div>
                      </div>
                      <ArrowRight className="text-blue-200 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={20} />
                  </button>
                )}
                {settings.isDeliveryActive && (
                  <button onClick={() => { setOrderType('ENTREGA'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-green-50/50 hover:bg-green-100/50 rounded-[1.8rem] transition-all border border-green-100 active:scale-95 text-left">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-white rounded-2xl text-green-600 shadow-sm transition-transform group-hover:scale-110"><Truck size={28} /></div>
                          <div>
                            <p className="font-bold text-lg text-primary leading-none">Entrega</p>
                            <p className="text-[10px] text-green-700 opacity-60 font-black uppercase mt-1 tracking-wider">Receber em casa</p>
                          </div>
                      </div>
                      <ArrowRight className="text-green-200 group-hover:text-green-400 group-hover:translate-x-1 transition-all" size={20} />
                  </button>
                )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-orange-50/40 text-primary relative flex flex-col font-sans text-zinc-900">
      <header className={`sticky top-0 z-30 shadow-md ${isWaitstaff ? 'bg-secondary' : 'bg-primary'} text-white p-3 md:p-4 transition-all w-full`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full shrink-0">
              {isWaitstaff ? <ArrowLeft size={22} /> : <ChevronLeft size={22} />}
            </button>
            <div className="flex flex-col min-w-0">
                <h1 className="font-brand text-sm md:text-base font-bold leading-none truncate">{settings.storeName}</h1>
                <button onClick={handleResetMode} className="text-[9px] uppercase font-black opacity-70 truncate mt-0.5 text-left hover:opacity-100 underline decoration-dotted underline-offset-2">
                  {orderType} {(orderType === 'MESA' || orderType === 'COMANDA') && manualTable ? `• ${orderType === 'MESA' ? 'Mesa' : 'Comanda'} ${manualTable}` : ''}
                </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsInfoOpen(true)} className="p-2.5 bg-white/10 rounded-full shrink-0 active:scale-90 transition-transform"><Info size={20} /></button>
            <button onClick={() => { setIsCartOpen(true); setCheckoutStep('cart'); }} className="relative p-2.5 bg-white/10 rounded-full shrink-0 active:scale-90 transition-transform">
              <ShoppingCart size={20} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-primary">{cart.length}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-5 flex-1 pb-24 text-zinc-900 overflow-x-hidden w-full box-border">
        {isStoreClosed && !isWaitstaff && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3 animate-pulse">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <p className="text-[10px] font-black uppercase text-red-700 tracking-widest">A loja está fechada. Apenas visualização.</p>
          </div>
        )}

        <div className="relative group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="O que deseja comer hoje?" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl outline-none shadow-sm border border-gray-100 focus:ring-2 focus:ring-secondary/20 transition-all text-sm" />
        </div>

        {!searchTerm && featuredProduct && activeCategory === 'Todos' && (
          <section className="animate-fade-in w-full">
             <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-xl border border-orange-100 flex flex-row gap-3 sm:gap-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-1.5 sm:p-2 bg-orange-500 text-white rounded-bl-2xl z-20 shadow-sm"><Flame size={12} className="animate-pulse" /></div>
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-gray-100">
                    <img src={featuredProduct.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" alt={featuredProduct.name} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                   <div>
                      <div className="flex items-center gap-1 mb-1"><span className="bg-orange-100 text-orange-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Destaque</span></div>
                      <h3 className="text-xs sm:text-sm font-bold text-primary truncate leading-tight">{featuredProduct.name}</h3>
                      <p className="text-[9px] sm:text-[10px] text-gray-500 line-clamp-2 mt-1 leading-relaxed">{featuredProduct.description}</p>
                   </div>
                   <div className="flex items-end justify-between gap-1 mt-1">
                      <span className="text-sm sm:text-lg font-black text-secondary whitespace-nowrap">R$ {featuredProduct.price.toFixed(2)}{featuredProduct.isByWeight ? '/kg' : ''}</span>
                      {!isStoreClosed && <button onClick={() => handleAddToCart(featuredProduct)} className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-white font-bold text-[9px] sm:text-[11px] shadow-lg active:scale-95 transition-all flex items-center gap-1.5 shrink-0 ${isWaitstaff ? 'bg-secondary' : 'bg-primary'}`}><PlusIcon size={12} /> <span className="whitespace-nowrap">ADICIONAR</span></button>}
                   </div>
                </div>
             </div>
          </section>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-3 sm:-mx-4 px-3 sm:px-4 w-full">
            {categories.map(cat => (
              <button key={cat} onClick={() => { setActiveCategory(cat); setSearchTerm(''); }} className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl whitespace-nowrap font-bold text-[10px] sm:text-[11px] border transition-all ${activeCategory === cat ? (isWaitstaff ? 'bg-secondary text-white border-secondary shadow-sm' : 'bg-primary text-white border-primary shadow-sm') : 'bg-white text-gray-400 border-gray-100'}`}>{cat}</button>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
          {filteredProducts.map(product => (
            <div key={product.id} className={`bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm flex gap-2.5 sm:gap-3 items-center border border-gray-50 transition-all w-full box-border ${!product.isActive ? 'opacity-50 grayscale' : ''}`}>
              <div className="relative shrink-0">
                <img src={product.imageUrl} className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 object-cover rounded-xl" alt={product.name} />
                {product.isByWeight && <div className="absolute -top-1 -right-1 bg-blue-600 text-white p-1 rounded-lg border border-white shadow-sm"><Scale size={10} /></div>}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                <div className="min-w-0">
                  <h3 className="font-bold text-[11px] sm:text-[12px] md:text-sm truncate leading-tight text-zinc-900">{product.name}</h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-400 line-clamp-1 mt-0.5">{product.description}</p>
                </div>
                <div className="flex items-center justify-between mt-2 gap-1.5">
                  <span className="font-bold text-secondary text-[10px] sm:text-xs md:text-sm whitespace-nowrap">R$ {product.price.toFixed(2)}{product.isByWeight ? '/kg' : ''}</span>
                  {!isStoreClosed && <button onClick={() => handleAddToCart(product)} className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-white flex items-center gap-1 shadow-sm text-[9px] sm:text-[10px] font-bold transition-all active:scale-95 shrink-0 ${isWaitstaff ? 'bg-secondary' : 'bg-primary'}`}><PlusIcon size={12} /> <span className="whitespace-nowrap">Add</span></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL DO CARRINHO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up border border-orange-100">
             <header className="p-6 border-b flex items-center justify-between bg-orange-50/50">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-primary text-secondary rounded-xl shadow-sm"><ShoppingCart size={20} /></div>
                   <h2 className="text-xl font-brand font-bold text-primary">Minha Sacola</h2>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm"><X size={24} /></button>
             </header>

             <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {checkoutStep === 'cart' ? (
                  <div className="space-y-6">
                     {cart.length === 0 ? (
                       <div className="py-20 text-center space-y-4">
                          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><ShoppingBag size={40} className="text-gray-200" /></div>
                          <p className="text-gray-400 font-bold">Sua sacola está vazia.</p>
                          <button onClick={() => setIsCartOpen(false)} className="text-secondary font-black text-xs uppercase tracking-widest">Voltar ao Menu</button>
                       </div>
                     ) : (
                       <>
                         <div className="space-y-4">
                            {cart.map(item => (
                              <div key={item.productId} className="flex items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100 group">
                                 <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-800 truncate">{item.name}</h4>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">R$ {item.price.toFixed(2)} {item.isByWeight ? '/kg' : 'un'}</p>
                                 </div>
                                 <div className="flex items-center bg-white rounded-2xl border border-gray-100 p-1 shadow-sm">
                                    <button onClick={() => updateCartItemQuantity(item.productId, -1)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><MinusIcon size={14} /></button>
                                    <span className="px-3 font-black text-sm text-primary min-w-[3rem] text-center">
                                       {item.isByWeight ? `${item.quantity.toFixed(3)}kg` : item.quantity}
                                    </span>
                                    <button onClick={() => updateCartItemQuantity(item.productId, 1)} className="p-2 text-gray-400 hover:text-green-500 transition-colors"><PlusIcon size={14} /></button>
                                 </div>
                              </div>
                            ))}
                         </div>

                         {/* CUPOM */}
                         <div className="pt-6 border-t border-gray-100">
                             <div className="flex items-center gap-3 mb-3">
                                <Tag size={18} className="text-orange-500" />
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cupom de Desconto</span>
                             </div>
                             {appliedCoupon ? (
                               <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-2xl">
                                  <div className="flex items-center gap-3 text-green-700">
                                     <CheckCircle size={18} />
                                     <span className="font-bold text-sm">CUPOM: {appliedCoupon.code} (-{appliedCoupon.discount}%)</span>
                                  </div>
                                  <button onClick={() => setAppliedCoupon(null)} className="text-[10px] font-black text-red-400 uppercase">Remover</button>
                               </div>
                             ) : (
                               <div className="flex gap-2">
                                  <input type="text" placeholder="EX: NATAL10" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold" />
                                  <button onClick={handleApplyCoupon} className="px-6 py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase">Aplicar</button>
                               </div>
                             )}
                         </div>

                         <div className="bg-primary p-6 rounded-[2rem] text-white space-y-2 shadow-xl shadow-black/5">
                            <div className="flex justify-between text-xs opacity-60"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                            {discountAmount > 0 && <div className="flex justify-between text-xs text-secondary font-bold"><span>Desconto ({appliedCoupon?.code})</span><span>-R$ {discountAmount.toFixed(2)}</span></div>}
                            <div className="flex justify-between items-end pt-2">
                               <span className="text-sm font-bold uppercase tracking-widest">Total</span>
                               <span className="text-3xl font-black text-secondary">R$ {cartTotal.toFixed(2)}</span>
                            </div>
                         </div>

                         <button onClick={() => setCheckoutStep('details')} className="w-full py-5 bg-secondary text-primary rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">Prosseguir para Identificação</button>
                       </>
                     )}
                  </div>
                ) : checkoutStep === 'details' ? (
                  <div className="space-y-6">
                     <button onClick={() => setCheckoutStep('cart')} className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2"><ChevronLeft size={14}/> Voltar para Sacola</button>
                     
                     <div className="space-y-4">
                        {orderType === 'MESA' || orderType === 'COMANDA' ? (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Número da {orderType === 'MESA' ? 'Mesa' : 'Comanda'}</label>
                              <div className="relative">
                                 <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                 <input type="number" value={manualTable} onChange={e => setManualTable(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-lg" placeholder="EX: 01" />
                              </div>
                           </div>
                        ) : (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome do Cliente</label>
                              <div className="relative">
                                 <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                 <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="Digite seu nome" />
                              </div>
                           </div>
                        )}

                        {orderType === 'ENTREGA' && (
                          <>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Telefone (WhatsApp)</label>
                                <div className="relative">
                                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                   <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="85 9..." />
                                </div>
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Endereço Completo</label>
                                <div className="relative">
                                   <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                   <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="Rua, Número, Bairro..." />
                                </div>
                             </div>
                          </>
                        )}

                        <div className="space-y-4 pt-4 border-t border-gray-100">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Método de Pagamento</p>
                           <div className="grid grid-cols-3 gap-2">
                              {[
                                {id: 'PIX', icon: <DollarSign size={18}/>, label: 'PIX'},
                                {id: 'CARTAO', icon: <CreditCard size={18}/>, label: 'Cartão'},
                                {id: 'DINHEIRO', icon: <Banknote size={18}/>, label: 'Dinheiro'}
                              ].map(m => (
                                <button key={m.id} onClick={() => setPayment(m.id as any)} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${payment === m.id ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>
                                   {m.icon}
                                   <span className="text-[10px] font-black uppercase">{m.label}</span>
                                </button>
                              ))}
                           </div>
                        </div>

                        {payment === 'DINHEIRO' && (
                           <div className="space-y-2 animate-scale-up">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Troco para quanto?</label>
                              <input type="number" value={changeFor} onChange={e => setChangeFor(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="Deixe vazio se não precisar" />
                           </div>
                        )}

                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Observações (Opcional)</label>
                           <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none h-24 resize-none font-medium text-sm" placeholder="Ex: Sem cebola, ponto da carne..." />
                        </div>
                     </div>

                     <button disabled={isSending} onClick={handleCheckout} className="w-full py-5 bg-secondary text-primary rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">
                        {isSending ? <Loader2 className="animate-spin" size={24}/> : <><Send size={20}/> Finalizar e Enviar Pedido</>}
                     </button>
                  </div>
                ) : (
                  <div className="py-12 text-center animate-scale-up space-y-6">
                     <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce"><Check size={48} strokeWidth={4} /></div>
                     <div>
                        <h3 className="text-3xl font-brand font-bold text-primary">Pedido Enviado!</h3>
                        <p className="text-gray-500 mt-2 font-medium">Já estamos preparando suas delícias.</p>
                     </div>
                     <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-left space-y-2">
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase">Senha do Pedido</span><span className="text-xl font-black text-primary">#{Math.floor(1000 + Math.random() * 9000)}</span></div>
                        <p className="text-[10px] text-gray-400 leading-snug">Fique atento ao painel da loja ou aguarde nosso atendente chamar.</p>
                     </div>
                     
                     <div className="flex flex-col gap-3">
                        <button onClick={() => { setIsCartOpen(false); setCheckoutStep('cart'); }} className="w-full py-5 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Lançar outro item na sacola</button>
                        
                        {isWaitstaff && (
                           <button 
                             onClick={handleBack} 
                             className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                           >
                             <ArrowLeft size={16} /> Concluir e Voltar ao Mapa
                           </button>
                        )}
                     </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMAÇÕES DA LOJA */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl animate-scale-up overflow-hidden border border-orange-100">
            <div className="p-8 border-b bg-orange-50 text-center relative text-zinc-900">
               <button onClick={() => setIsInfoOpen(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm"><X size={20} /></button>
               <img src={settings.logoUrl} className="w-20 h-20 rounded-full border-4 border-white shadow-xl mx-auto mb-4 object-cover" />
               <h2 className="text-xl font-brand font-bold text-primary">{settings.storeName}</h2>
               <div className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase mt-2 tracking-widest ${settings.isStoreOpen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{settings.isStoreOpen ? 'Aberto Agora' : 'Fechado no Momento'}</div>
            </div>
            <div className="p-8 space-y-4">
               {settings.address && (
                 <div className="flex items-start gap-4 p-2">
                    <div className="p-3 bg-gray-50 rounded-2xl text-primary border border-gray-100"><MapPin size={20} /></div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Localização</p>
                       <p className="text-sm font-bold text-gray-700 leading-snug">{settings.address}</p>
                       <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" className="text-[10px] font-black text-secondary flex items-center gap-1 mt-1 uppercase">VER NO MAPA <Navigation size={10} /></a>
                    </div>
                 </div>
               )}

               {settings.whatsapp && (
                 <div className="flex items-start gap-4 p-2 border-t border-gray-100 pt-4">
                    <div className="p-3 bg-green-50 rounded-2xl text-green-600 border border-green-100"><Phone size={20} /></div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">WhatsApp</p>
                       <p className="text-sm font-bold text-gray-700 leading-snug">{settings.whatsapp}</p>
                       <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" className="text-[10px] font-black text-green-600 flex items-center gap-1 mt-1 uppercase">INICIAR CONVERSA <MessageCircle size={10} /></a>
                    </div>
                 </div>
               )}

               <div className="pt-4 border-t border-gray-100">
                  <button onClick={() => setIsInfoOpen(false)} className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-xl text-xs uppercase tracking-widest">Voltar</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PESO (KG) */}
      {weightProduct && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-scale-up space-y-6">
             <div className="text-center">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100"><Scale size={40} /></div>
                <h3 className="text-xl font-bold text-gray-800">{weightProduct.name}</h3>
                <p className="text-xs text-gray-400 uppercase font-black tracking-widest mt-1">Preço: R$ {weightProduct.price.toFixed(2)}/kg</p>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Informe o peso em Gramas</label>
                <div className="relative">
                   <input type="number" autoFocus value={selectedWeightGrams} onChange={e => setSelectedWeightGrams(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-black text-2xl text-center" placeholder="Ex: 500" />
                   <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-gray-300">g</span>
                </div>
                <div className="flex justify-between px-4">
                   <p className="text-[10px] text-gray-400 font-bold uppercase">Equivale a: { (parseFloat(selectedWeightGrams || "0")/1000).toFixed(3) } kg</p>
                   <p className="text-sm font-black text-secondary">R$ { (weightProduct.price * (parseFloat(selectedWeightGrams || "0")/1000)).toFixed(2) }</p>
                </div>
             </div>
             <div className="flex gap-3 pt-4">
                <button onClick={() => setWeightProduct(null)} className="flex-1 py-4 font-bold text-gray-400">Cancelar</button>
                <button onClick={confirmWeightAddition} disabled={!selectedWeightGrams} className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold shadow-xl disabled:opacity-50">Adicionar à Sacola</button>
             </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default DigitalMenu;
