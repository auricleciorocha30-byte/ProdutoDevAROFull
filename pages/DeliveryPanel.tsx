import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Navigation, 
  Clock, 
  Package,
  LogOut,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, Waitstaff, StoreSettings } from '../types';

interface DeliveryPanelProps {
  storeId: string;
  user: Waitstaff;
  settings: StoreSettings;
  onLogout: () => void;
}

export default function DeliveryPanel({ storeId, user, settings, onLogout }: DeliveryPanelProps) {
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [historyDeliveries, setHistoryDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'mine' | 'history' | 'all'>('mine');
  const [couriers, setCouriers] = useState<Waitstaff[]>([]);

  useEffect(() => {
    if (user.role === 'GERENTE') {
        setActiveTab('all');
        fetchCouriers();
    }
  }, [user.role]);

  const fetchCouriers = async () => {
      const { data } = await supabase.from('waitstaff').select('*').eq('store_id', storeId).eq('role', 'ENTREGADOR');
      if (data) setCouriers(data);
  };
  const [weeklyCount, setWeeklyCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCountRef = useRef(0);

  useEffect(() => {
    fetchDeliveries();
    fetchWeeklyCount();
    const interval = setInterval(() => {
        fetchDeliveries();
        fetchWeeklyCount();
    }, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [storeId]);

  useEffect(() => {
      if (activeTab === 'history') {
          fetchHistory();
      }
  }, [activeTab]);

  const fetchWeeklyCount = async () => {
      if (!storeId || !user.id) return;
      
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).setHours(0,0,0,0);
      
      try {
          const { data, error } = await supabase
              .from('orders')
              .select('id')
              .eq('store_id', storeId)
              .eq('type', 'ENTREGA')
              .eq('deliveryDriverId', user.id)
              .eq('status', 'ENTREGUE')
              .gte('createdAt', startOfWeek);
              
          if (!error && data) {
              setWeeklyCount(data.length);
          }
      } catch (err) {
          console.error("Erro ao buscar contador semanal:", err);
      }
  };

  const fetchHistory = async () => {
      if (!storeId || !user.id) return;
      setLoading(true);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();

      try {
          const { data, error } = await supabase
              .from('orders')
              .select('*')
              .eq('store_id', storeId)
              .eq('type', 'ENTREGA')
              .eq('deliveryDriverId', user.id)
              .eq('status', 'ENTREGUE')
              .gte('createdAt', startOfDay)
              .order('createdAt', { ascending: false });
              
          if (!error && data) {
              setHistoryDeliveries(data as Order[]);
          }
      } catch (err) {
          console.error("Erro ao buscar histórico:", err);
      } finally {
          setLoading(false);
      }
  };

  const fetchDeliveries = async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    // Don't set loading to true on poll to avoid flickering
    // setLoading(true); 
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('type', 'ENTREGA')
        .in('status', ['AGUARDANDO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'CHEGUEI_NA_ORIGEM'])
        .order('createdAt', { ascending: false });
      
      if (error) throw error;

      if (data) {
        setDeliveries(data as Order[]);
        
        // Check for new unassigned "PRONTO" orders to play sound
        const newAvailableCount = data.filter((o: Order) => 
            o.status === 'PRONTO' && (!o.deliveryDriverId || o.deliveryDriverId === '' || o.deliveryDriverId === 'null' || o.deliveryDriverId === 'undefined')
        ).length;
        
        if (newAvailableCount > previousCountRef.current) {
          playSound();
        }
        previousCountRef.current = newAvailableCount;
      }
    } catch (err) {
      console.error("Erro ao buscar entregas:", err);
    } finally {
      setLoading(false);
    }
  };

  const playSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audio.play().catch(e => console.log("Audio blocked", e));
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (!orderId) return;
    await supabase
      .from('orders')
      .eq('id', orderId)
      .update({ status: newStatus });
    fetchDeliveries();
  };

  const acceptDelivery = async (orderId: string) => {
    if (!orderId) return;
    await supabase
      .from('orders')
      .eq('id', orderId)
      .update({ deliveryDriverId: user.id });
    fetchDeliveries();
    setActiveTab('mine');
  };

    const openMap = (address: string) => {
        if (!address) return;
        const encoded = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const availableDeliveries = deliveries.filter(o => 
    ['AGUARDANDO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA'].includes(o.status) && (!o.deliveryDriverId || o.deliveryDriverId === '' || o.deliveryDriverId === 'null' || o.deliveryDriverId === 'undefined')
  );

  const myDeliveries = deliveries.filter(o => 
    o.deliveryDriverId === user.id
  );

  const displayedDeliveries = activeTab === 'available' 
    ? availableDeliveries 
    : activeTab === 'history' 
        ? historyDeliveries 
        : activeTab === 'all'
            ? deliveries
            : myDeliveries;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-20">
      <header className="bg-blue-900 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Truck size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Painel de Entregas</h1>
              <p className="text-xs text-blue-200">Olá, {user.name} ({user.role})</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Entregas na Semana</span>
                <span className="text-xl font-black">{weeklyCount}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchDeliveries} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <RefreshCw size={20} />
              </button>
              <button onClick={onLogout} className="p-2 hover:bg-red-500/20 rounded-full transition-colors text-red-200 hover:text-red-100">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-2 md:hidden flex justify-between items-center bg-blue-800/50 p-2 rounded-lg">
            <span className="text-xs text-blue-200 uppercase font-bold tracking-wider">Entregas na Semana</span>
            <span className="text-lg font-black">{weeklyCount}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-6 overflow-x-auto">
            {user.role === 'GERENTE' && (
                <button 
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                        activeTab === 'all' 
                        ? 'bg-blue-900 text-white shadow-sm' 
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <Truck size={16} />
                    Todos ({deliveries.length})
                </button>
            )}
            <button 
                onClick={() => setActiveTab('mine')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                    activeTab === 'mine' 
                    ? 'bg-blue-100 text-blue-700 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
            >
                <Truck size={16} />
                Minhas ({myDeliveries.length})
            </button>
            <button 
                onClick={() => setActiveTab('available')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                    activeTab === 'available' 
                    ? 'bg-green-100 text-green-700 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
            >
                <Package size={16} />
                Disponíveis ({availableDeliveries.length})
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                    activeTab === 'history' 
                    ? 'bg-purple-100 text-purple-700 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
            >
                <Clock size={16} />
                Histórico
            </button>
        </div>

        {loading && deliveries.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
          </div>
        ) : displayedDeliveries.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <Package size={64} className="mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-bold text-gray-500">
                {activeTab === 'available' 
                    ? 'Nenhuma entrega disponível' 
                    : activeTab === 'history'
                        ? 'Nenhuma entrega no histórico recente'
                        : 'Você não tem entregas ativas'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedDeliveries.map(order => {
              const isReady = order.status === 'PRONTO';
              const isPreparing = order.status === 'PREPARANDO';
              const isWaiting = order.status === 'AGUARDANDO';
              const isDelivered = order.status === 'ENTREGUE';
              
              let borderColor = 'border-blue-100';
              let headerBg = 'bg-blue-50';
              let badgeStyle = 'bg-blue-200 text-blue-800';

              if (isReady) {
                  borderColor = 'border-green-100';
                  headerBg = 'bg-green-50';
                  badgeStyle = 'bg-green-200 text-green-800';
              } else if (isPreparing) {
                  borderColor = 'border-orange-100';
                  headerBg = 'bg-orange-50';
                  badgeStyle = 'bg-orange-200 text-orange-800';
              } else if (isWaiting) {
                  borderColor = 'border-yellow-100';
                  headerBg = 'bg-yellow-50';
                  badgeStyle = 'bg-yellow-200 text-yellow-800';
              } else if (isDelivered) {
                  borderColor = 'border-gray-100 opacity-75';
                  headerBg = 'bg-gray-50';
                  badgeStyle = 'bg-gray-200 text-gray-800';
              }

              return (
              <div key={order.id} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${borderColor}`}>
                <div className={`p-4 flex justify-between items-center ${headerBg}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-gray-700">#{order.displayId || String(order.id).slice(0,8)}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${badgeStyle}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                    <Clock size={14} />
                    {formatDate(order.createdAt)}
                  </div>
                </div>

                {activeTab === 'all' && order.deliveryDriverId && (
                    <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
                        <Truck size={14} className="text-yellow-600" />
                        <span className="text-xs font-bold text-yellow-800">
                            Entregador: {couriers.find(c => c.id === order.deliveryDriverId)?.name || 'Desconhecido'}
                        </span>
                    </div>
                )}

                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="text-gray-400 mt-1 shrink-0" size={18} />
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{order.deliveryAddress || 'Endereço não informado'}</p>
                      <p className="text-xs text-gray-500">{order.customerName}</p>
                    </div>
                  </div>
                  
                  {order.customerPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="text-gray-400 shrink-0" size={18} />
                      <a href={`tel:${order.customerPhone}`} className="text-sm font-bold text-blue-600 hover:underline">
                        {order.customerPhone}
                      </a>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-bold uppercase">Total a Receber</span>
                        {order.paymentMethod === 'A_PAGAR' && (
                            <span className="text-[10px] font-bold text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded mt-1 inline-block w-max">
                                Cobrar na Entrega
                            </span>
                        )}
                    </div>
                    <span className="text-xl font-black text-gray-900">{formatCurrency(order.total)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {activeTab === 'available' ? (
                        <button 
                            onClick={() => acceptDelivery(order.id)}
                            className={`col-span-2 py-3 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isReady || order.status === 'SAIU_PARA_ENTREGA' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <UserCheck size={18} />
                            {isReady || order.status === 'SAIU_PARA_ENTREGA' ? 'Aceitar Entrega' : 'Aceitar e Aguardar'}
                        </button>
                    ) : (
                        <>
                            {(isReady || isPreparing || isWaiting) ? (
                                <>
                                    {order.originAddress && (
                                        <button 
                                            onClick={() => openMap(order.originAddress || '')}
                                            className="py-3 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Navigation size={18} />
                                            Rota Origem
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => updateStatus(order.id, 'CHEGUEI_NA_ORIGEM')}
                                        className={`${order.originAddress ? 'col-span-1' : 'col-span-2'} py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2`}
                                    >
                                        <MapPin size={18} />
                                        Cheguei na Origem
                                    </button>
                                </>
                            ) : order.status === 'CHEGUEI_NA_ORIGEM' ? (
                                <button 
                                    onClick={() => updateStatus(order.id, 'SAIU_PARA_ENTREGA')}
                                    className="col-span-2 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Truck size={18} />
                                    Iniciar Entrega
                                </button>
                            ) : order.status === 'ENTREGUE' ? (
                                <div className="col-span-2 py-2 text-center text-gray-400 text-sm font-bold uppercase flex items-center justify-center gap-2 bg-gray-50 rounded-xl border border-gray-100">
                                    <CheckCircle2 size={16} />
                                    Entrega Concluída
                                </div>
                            ) : (
                                <>
                                    <button 
                                    onClick={() => openMap(order.deliveryAddress || '')}
                                    className="py-3 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                                    >
                                    <Navigation size={18} />
                                    Rota Destino
                                    </button>
                                    <button 
                                    onClick={() => updateStatus(order.id, 'ENTREGUE')}
                                    className="py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                    <CheckCircle2 size={18} />
                                    Finalizar
                                    </button>
                                </>
                            )}
                        </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
