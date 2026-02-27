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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('mine');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCountRef = useRef(0);

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [storeId]);

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
        .in('status', ['PRONTO', 'SAIU_PARA_ENTREGA'])
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
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const availableDeliveries = deliveries.filter(o => 
    o.status === 'PRONTO' && (!o.deliveryDriverId || o.deliveryDriverId === '' || o.deliveryDriverId === 'null' || o.deliveryDriverId === 'undefined')
  );

  const myDeliveries = deliveries.filter(o => 
    o.deliveryDriverId === user.id
  );

  const displayedDeliveries = activeTab === 'available' ? availableDeliveries : myDeliveries;

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
              <p className="text-xs text-blue-200">Olá, {user.name}</p>
            </div>
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
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-6">
            <button 
                onClick={() => setActiveTab('mine')}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
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
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'available' 
                    ? 'bg-green-100 text-green-700 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
            >
                <Package size={16} />
                Disponíveis ({availableDeliveries.length})
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
                {activeTab === 'available' ? 'Nenhuma entrega disponível' : 'Você não tem entregas ativas'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedDeliveries.map(order => (
              <div key={order.id} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${order.status === 'PRONTO' ? 'border-green-100' : 'border-blue-100'}`}>
                <div className={`p-4 flex justify-between items-center ${order.status === 'PRONTO' ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-gray-700">#{order.id}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${order.status === 'PRONTO' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                    <Clock size={14} />
                    {formatDate(order.createdAt)}
                  </div>
                </div>

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
                            className="col-span-2 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <UserCheck size={18} />
                            Aceitar Entrega
                        </button>
                    ) : (
                        <>
                            {order.status === 'PRONTO' ? (
                                <button 
                                    onClick={() => updateStatus(order.id, 'SAIU_PARA_ENTREGA')}
                                    className="col-span-2 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Truck size={18} />
                                    Iniciar Entrega
                                </button>
                            ) : (
                                <>
                                    <button 
                                    onClick={() => openMap(order.deliveryAddress || '')}
                                    className="py-3 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                                    >
                                    <Navigation size={18} />
                                    Rota
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
