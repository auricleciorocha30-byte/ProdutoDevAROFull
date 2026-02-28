
import React, { useRef, useState, useEffect } from 'react';
import { StoreSettings, Product } from '../types';
import { Switch } from '../components/Switch';
import { supabase } from '../lib/supabase';
import { 
  Save, 
  ImageIcon, 
  Palette, 
  Camera, 
  Database, 
  Globe,
  Store,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  ExternalLink,
  MapPin,
  Phone,
  Ticket,
  Percent,
  Search,
  Check,
  Download,
  Upload,
  AlertTriangle,
  Power,
  Layers,
  LayoutGrid,
  Utensils,
  ChefHat,
  Tv
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
  products: Product[];
  onSave: (s: StoreSettings) => Promise<void>;
  storeId?: string;
}

const StoreSettingsPage: React.FC<Props> = ({ settings, products, onSave, storeId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [localSettings, setLocalSettings] = useState<StoreSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { 
        alert("A imagem é muito grande. Escolha uma imagem de até 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLocalSettings(prev => ({ ...prev, logoUrl: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(localSettings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar as configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!window.confirm("Deseja gerar um backup completo dos dados do sistema?")) return;
    setIsExporting(true);
    try {
      const { data, error } = await (supabase as any).backupDatabase(storeId); 
      if (error) throw error;

      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DevARO_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro no backup:", error);
      alert("Falha ao gerar backup.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("AVISO CRÍTICO: Restaurar dados irá sobrescrever informações atuais. Deseja continuar?")) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonString = event.target?.result as string;
        const { success, error } = await (supabase as any).restoreDatabase(jsonString, storeId);
        
        if (error) throw error;
        
        alert("Restauração concluída com sucesso! O sistema será reiniciado.");
        window.location.reload();
      } catch (error: any) {
        console.error("Erro na restauração:", error);
        alert("Erro ao importar dados: " + error.message);
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const toggleProductSelection = (productId: string) => {
    const current = localSettings.applicableProductIds || [];
    if (current.includes(productId)) {
        setLocalSettings({...localSettings, applicableProductIds: current.filter(id => id !== productId)});
    } else {
        setLocalSettings({...localSettings, applicableProductIds: [...current, productId]});
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 text-zinc-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-brand font-bold text-gray-800">Identidade & Configurações</h1>
          <p className="text-gray-500">Personalize as cores, logo e canais de contato.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl active:scale-95 disabled:opacity-50 min-w-[180px]"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {isSaving ? "Salvando..." : "Salvar Agora"}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl flex items-center gap-3 animate-slide-up">
          <CheckCircle2 size={20} />
          Alterações aplicadas com sucesso!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Power size={16} /> Operação
            </h2>
            <div className={`p-4 rounded-2xl border-2 transition-all w-full flex items-center justify-between ${localSettings.isStoreOpen ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'}`}>
              <span className={`text-sm font-bold ${localSettings.isStoreOpen ? 'text-green-700' : 'text-red-700'}`}>
                {localSettings.isStoreOpen ? 'LOJA ABERTA' : 'LOJA FECHADA'}
              </span>
              <Switch checked={localSettings.isStoreOpen ?? true} onChange={(v) => setLocalSettings({...localSettings, isStoreOpen: v})} />
            </div>

            <div className="w-full mt-6 space-y-3 pt-6 border-t border-gray-100">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest text-center mb-2">Módulos do Sistema</p>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Utensils size={16} className="text-orange-500" />
                        <span className="text-xs font-bold text-gray-600">Módulo Mesas</span>
                    </div>
                    <Switch checked={localSettings.isTableOrderActive} onChange={(v) => setLocalSettings({...localSettings, isTableOrderActive: v})} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <ChefHat size={16} className="text-blue-500" />
                        <span className="text-xs font-bold text-gray-600">Módulo Cozinha</span>
                    </div>
                    <Switch checked={localSettings.isKitchenActive ?? true} onChange={(v) => setLocalSettings({...localSettings, isKitchenActive: v})} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Tv size={16} className="text-purple-500" />
                        <span className="text-xs font-bold text-gray-600">Módulo Painel TV</span>
                    </div>
                    <Switch checked={localSettings.isTvPanelActive ?? true} onChange={(v) => setLocalSettings({...localSettings, isTvPanelActive: v})} />
                </div>
            </div>

            <div className="w-full mt-6 space-y-3 pt-6 border-t border-gray-100">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest text-center mb-2">Canais de Venda (Menu Digital)</p>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={16} className="text-blue-500" />
                        <span className="text-xs font-bold text-gray-600">Pedidos Balcão</span>
                    </div>
                    <Switch checked={localSettings.isCounterPickupActive} onChange={(v) => setLocalSettings({...localSettings, isCounterPickupActive: v})} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Truck size={16} className="text-green-500" />
                        <span className="text-xs font-bold text-gray-600">Pedidos Entrega</span>
                    </div>
                    <Switch checked={localSettings.isDeliveryActive} onChange={(v) => setLocalSettings({...localSettings, isDeliveryActive: v})} />
                </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">Logotipo do Menu</h2>
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-40 h-40 rounded-full border-4 border-orange-100 overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner relative transition-transform hover:scale-105">
                {localSettings.logoUrl ? (
                  <img src={localSettings.logoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={48} className="text-gray-200" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Camera size={32} className="text-white" />
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">QR Code Pix</h2>
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('pix-upload')?.click()}>
              <div className="w-40 h-40 rounded-2xl border-4 border-blue-100 overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner relative transition-transform hover:scale-105">
                {localSettings.pixQrCodeUrl ? (
                  <img src={localSettings.pixQrCodeUrl} alt="QR Code Pix" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-gray-300">
                    <ImageIcon size={32} />
                    <span className="text-[10px] font-bold mt-2">Adicionar QR</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Camera size={32} className="text-white" />
                </div>
              </div>
              <input 
                id="pix-upload"
                type="file" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 1024 * 1024) { 
                      alert("A imagem é muito grande. Escolha uma imagem de até 1MB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setLocalSettings(prev => ({ ...prev, pixQrCodeUrl: reader.result as string }));
                    };
                    reader.readAsDataURL(file);
                  }
                }} 
                className="hidden" 
                accept="image/*" 
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-4 text-center max-w-[200px]">
              Faça upload do QR Code do seu Pix para exibir no PDV.
            </p>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Database size={16} /> Manutenção de Dados
            </h2>
            <div className="space-y-4">
              <button onClick={handleBackup} disabled={isExporting} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-orange-50 rounded-2xl border border-gray-100 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-orange-500 shadow-sm"><Download size={18} /></div>
                  <span className="text-sm font-bold text-gray-700">Fazer Backup</span>
                </div>
                {isExporting ? <Loader2 size={16} className="animate-spin text-orange-500" /> : <Database size={16} className="text-gray-300 group-hover:text-orange-500" />}
              </button>
              <button onClick={() => importFileRef.current?.click()} disabled={isImporting} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 rounded-2xl border border-gray-100 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-blue-500 shadow-sm"><Upload size={18} /></div>
                  <span className="text-sm font-bold text-gray-700">Restaurar Dados</span>
                </div>
                {isImporting ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <Database size={16} className="text-gray-300 group-hover:text-blue-500" />}
              </button>
              <input type="file" ref={importFileRef} onChange={handleRestore} className="hidden" accept=".json" />
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Palette size={16} /> Cores da Identidade
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase">Cor Principal</span>
                <input type="color" value={localSettings.primaryColor} onChange={(e) => setLocalSettings({...localSettings, primaryColor: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase">Cor Destaque</span>
                <input type="color" value={localSettings.secondaryColor} onChange={(e) => setLocalSettings({...localSettings, secondaryColor: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 md:col-span-2 xl:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <MapPin size={18} /> Contato & Localização
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Nome da Loja</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" value={localSettings.storeName} onChange={(e) => setLocalSettings({...localSettings, storeName: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Endereço Completo</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" placeholder="Rua, Número, Bairro, Cidade..." value={localSettings.address || ''} onChange={(e) => setLocalSettings({...localSettings, address: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">WhatsApp (Com DDD)</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" placeholder="Ex: 5511999999999" value={localSettings.whatsapp || ''} onChange={(e) => setLocalSettings({...localSettings, whatsapp: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 md:col-span-2 xl:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Ticket size={18} /> Cupom de Desconto
              </h2>
              <Switch checked={localSettings.isCouponActive || false} onChange={(v) => setLocalSettings({...localSettings, isCouponActive: v})} />
            </div>
            
            <div className={`space-y-6 transition-all ${localSettings.isCouponActive ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Nome do Cupom</label>
                  <input type="text" placeholder="Ex: BEMVINDO10" value={localSettings.couponName || ''} onChange={(e) => setLocalSettings({...localSettings, couponName: e.target.value.toUpperCase()})} className="w-full px-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Porcentagem (%)</label>
                  <div className="relative">
                    <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input type="number" placeholder="10" value={localSettings.couponDiscount || ''} onChange={(e) => setLocalSettings({...localSettings, couponDiscount: Number(e.target.value)})} className="w-full pl-4 pr-12 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold" />
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                      <div className="flex items-center gap-3">
                          <Layers className="text-orange-600" size={20} />
                          <span className="text-sm font-bold text-orange-900">Aplicar em todos os produtos</span>
                      </div>
                      <Switch checked={localSettings.isCouponForAllProducts ?? true} onChange={(v) => setLocalSettings({...localSettings, isCouponForAllProducts: v})} />
                  </div>

                  {!localSettings.isCouponForAllProducts && (
                      <div className="space-y-4 animate-scale-up">
                          <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                              <input 
                                  type="text" 
                                  placeholder="Buscar produtos para o cupom..." 
                                  value={productSearch}
                                  onChange={(e) => setProductSearch(e.target.value)}
                                  className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" 
                              />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                              {filteredProducts.map(product => {
                                  const isSelected = localSettings.applicableProductIds?.includes(product.id);
                                  return (
                                      <button 
                                          key={product.id}
                                          onClick={() => toggleProductSelection(product.id)}
                                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                      >
                                          <div className="relative">
                                            <img src={product.imageUrl} className="w-10 h-10 rounded-lg object-cover" />
                                            {isSelected && (
                                                <div className="absolute -top-1 -right-1 bg-orange-500 text-white p-0.5 rounded-full shadow-sm">
                                                    <Check size={10} />
                                                </div>
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                              <p className="text-xs font-bold text-gray-800 truncate">{product.name}</p>
                                              <p className="text-[10px] text-gray-400">{product.category}</p>
                                          </div>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>
                  )}
              </div>
            </div>
          </section>
      </div>
    </div>
  );
};

export default StoreSettingsPage;
