
import React, { useState } from 'react';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Camera, Star, Tag, X, Loader2, Weight, Power, ListTree } from 'lucide-react';
import { Switch } from '../components/Switch';
import { supabase } from '../lib/supabase';

interface Props {
  products: Product[];
  saveProduct: (p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  categories: string[];
  setCategories: (c: string[]) => void;
  storeId?: string;
  onCategoryChange?: () => void;
}

const MenuManagement: React.FC<Props> = ({ products, saveProduct, deleteProduct, categories, setCategories, storeId, onCategoryChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSaving(true);

    try {
        const productData: Partial<Product> = {
            id: editingProduct.id || Math.random().toString(36).substr(2, 9),
            name: editingProduct.name || '',
            description: editingProduct.description || '',
            price: Number(editingProduct.price) || 0,
            category: editingProduct.category || categories[0] || 'Geral',
            imageUrl: editingProduct.imageUrl || 'https://picsum.photos/400/300',
            isActive: editingProduct.isActive !== false,
            featuredDay: (editingProduct.featuredDay === -1 || editingProduct.featuredDay === undefined) ? undefined : Number(editingProduct.featuredDay),
            isByWeight: !!editingProduct.isByWeight,
            barcode: editingProduct.barcode || undefined,
            stock: editingProduct.stock !== undefined && !isNaN(Number(editingProduct.stock)) ? Number(editingProduct.stock) : undefined
        };

        await saveProduct(productData);
        setShowProductModal(false);
        setEditingProduct(null);
    } catch (err: any) {
        console.error('Falha ao salvar:', err);
        alert(`Erro ao salvar: ${err.message || 'Verifique sua conexão e tente novamente.'}`);
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;
    
    if (categories.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
        alert("Esta categoria já existe.");
        return;
    }

    if (!storeId) {
        alert("Erro: Loja não identificada. Recarregue a página.");
        return;
    }
    
    setIsSavingCategory(true);
    try {
      const { error } = await supabase.from('categories').insert([{ name: trimmedName, store_id: storeId }]);
      if (error) {
         if (error.code === '23505') { // Unique violation
             // If it exists in DB but not locally, add it to local state so user can use it
             if (!categories.includes(trimmedName)) {
                 setCategories([...categories, trimmedName]);
                 setNewCategoryName('');
                 alert("Categoria recuperada do banco de dados.");
             } else {
                 alert("Esta categoria já existe na lista.");
             }
         } else {
             throw error;
         }
      } else {
          setCategories([...categories, trimmedName]);
          setNewCategoryName('');
          if (onCategoryChange) onCategoryChange();
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao adicionar categoria: ${err.message}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    if (products.some(p => p.category === catName)) {
      alert("Não é possível excluir uma categoria que possui produtos vinculados.");
      return;
    }

    if (window.confirm(`Deseja excluir a categoria "${catName}"?`)) {
      try {
        const { error } = await supabase.from('categories').eq('name', catName).eq('store_id', storeId).delete();
        if (error) throw error;
        setCategories(categories.filter(c => c !== catName));
        if (onCategoryChange) onCategoryChange();
      } catch (err: any) {
        alert(`Erro ao excluir categoria: ${err.message}`);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir este produto?")) {
        try {
            await deleteProduct(id);
        } catch (err: any) {
            alert(`Erro ao excluir: ${err.message}`);
        }
    }
  };

  const days = [
    { id: 0, name: "Domingo" }, { id: 1, name: "Segunda" }, { id: 2, name: "Terça" },
    { id: 3, name: "Quarta" }, { id: 4, name: "Quinta" }, { id: 5, name: "Sexta" }, { id: 6, name: "Sábado" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar produtos..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                onClick={() => setShowCategoryModal(true)}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm flex-1 md:flex-none"
            >
                <ListTree size={20} /> Categorias
            </button>
            <button 
                onClick={() => { setEditingProduct({ category: categories[0] || '', description: '', featuredDay: -1, isActive: true, isByWeight: false }); setShowProductModal(true); }}
                className="px-6 py-3 bg-[#f68c3e] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors shadow-md flex-1 md:flex-none"
            >
                <Plus size={20} /> Novo Produto
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map(product => (
          <div key={product.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group relative ${!product.isActive ? 'opacity-50 grayscale' : ''}`}>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => { setEditingProduct(product); setShowProductModal(true); }} className="p-2 bg-white rounded-lg shadow text-blue-500 hover:bg-blue-50">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(product.id)} className="p-2 bg-white rounded-lg shadow text-red-500 hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                {!product.isActive && (
                    <span className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg uppercase">Indisponível</span>
                )}
                {product.isByWeight && (
                    <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1 uppercase">
                        <Weight size={10} /> Balança (KG)
                    </span>
                )}
            </div>

            <img src={product.imageUrl} className="w-full h-40 object-cover" alt={product.name} />
            <div className="p-4">
              <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    {product.category}
                  </span>
                  {product.featuredDay !== null && product.featuredDay !== undefined && product.featuredDay !== -1 && <Star size={14} className="text-yellow-500 fill-current" />}
              </div>
              <h3 className="font-bold text-sm text-gray-800 mt-2">{product.name}</h3>
              <p className="text-xs text-gray-400 line-clamp-1 mb-1">{product.description}</p>
              <p className="text-sm font-bold text-[#3d251e]">R$ {product.price.toFixed(2)} {product.isByWeight ? '/ KG' : ''}</p>
            </div>
          </div>
        ))}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold">Gerenciar Categorias</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nova Categoria</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newCategoryName} 
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Ex: Bebidas, Doces..."
                        />
                        <button 
                            onClick={handleAddCategory}
                            disabled={isSavingCategory || !newCategoryName.trim()}
                            className="px-4 py-2 bg-[#3d251e] text-white rounded-lg font-bold disabled:opacity-50"
                        >
                            {isSavingCategory ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20}/>}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Categorias Atuais</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {categories.map((cat, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                <span className="font-medium text-gray-700">{cat}</span>
                                <button 
                                    onClick={() => handleDeleteCategory(cat)}
                                    className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold">{editingProduct?.id ? 'Editar Produto' : 'Cadastrar Produto'}</h2>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 p-3 rounded-xl flex items-center justify-between border border-orange-100">
                    <div className="flex items-center gap-2">
                        <Power size={14} className={editingProduct?.isActive ? 'text-green-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">Produto Ativo</span>
                    </div>
                    <Switch checked={editingProduct?.isActive ?? true} onChange={(v) => setEditingProduct({...editingProduct, isActive: v})} />
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl flex items-center justify-between border border-blue-100">
                    <div className="flex items-center gap-2">
                        <Weight size={14} className={editingProduct?.isByWeight ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">Venda por KG</span>
                    </div>
                    <Switch checked={editingProduct?.isByWeight ?? false} onChange={(v) => setEditingProduct({...editingProduct, isByWeight: v})} />
                  </div>
              </div>

              <div className="flex gap-4 items-center">
                <div className="w-24 h-24 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 cursor-pointer overflow-hidden relative">
                  {editingProduct?.imageUrl ? ( <img src={editingProduct.imageUrl} className="w-full h-full object-cover" alt="Preview" /> ) : ( <> <Camera size={24} /> <span className="text-[10px]">Foto</span> </> )}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setEditingProduct({...editingProduct, imageUrl: reader.result as string});
                        reader.readAsDataURL(file);
                       }
                  }} />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Produto *</label>
                    <input required type="text" value={editingProduct?.name || ''} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição / Ingredientes</label>
                <textarea 
                  rows={2} 
                  value={editingProduct?.description || ''} 
                  onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})} 
                  className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm" 
                  placeholder="Ex: Pão fofinho feito com fermentação natural..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{editingProduct?.isByWeight ? 'Preço por KG (R$)' : 'Preço Unitário (R$)'}</label>
                  <input required type="number" step="0.01" value={editingProduct?.price || ''} onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    {editingProduct?.isByWeight ? 'Estoque Atual (KG)' : 'Estoque Atual (Unid)'}
                  </label>
                  <input type="number" step={editingProduct?.isByWeight ? "0.001" : "1"} value={editingProduct?.stock || ''} onChange={(e) => setEditingProduct({...editingProduct, stock: parseFloat(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="Opcional" />
                </div>
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                  <select required value={editingProduct?.category || ''} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none">
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código de Barras (Opcional)</label>
                  <input type="text" value={editingProduct?.barcode || ''} onChange={(e) => setEditingProduct({...editingProduct, barcode: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="EAN / Código" />
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Oferta do Dia (Exibir em Destaque)</label>
                  <select 
                    value={editingProduct?.featuredDay ?? -1} 
                    onChange={(e) => setEditingProduct({...editingProduct, featuredDay: parseInt(e.target.value)})} 
                    className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none"
                  >
                      <option value="-1">Nenhum dia</option>
                      {days.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}
                  </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-3 text-gray-400 font-bold">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-[#3d251e] text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"> 
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Produto'} 
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
