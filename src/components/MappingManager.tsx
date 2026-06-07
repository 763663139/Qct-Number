import React, { useState } from 'react';
import { ProductMapping } from '../types';
import { 
  Building2, User, Landmark, Tag, FileSpreadsheet, PlusCircle, 
  Trash2, Search, Edit2, Check, X, RefreshCcw, FileUp, Download 
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MappingManagerProps {
  mappings: ProductMapping[];
  setMappings: (m: ProductMapping[]) => void;
}

export default function MappingManager({ mappings, setMappings }: MappingManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Edit form state
  const [editProduct, setEditProduct] = useState<string>('');
  const [editShop, setEditShop] = useState<string>('');
  const [editShortName, setEditShortName] = useState<string>('');
  const [editMarketer, setEditMarketer] = useState<string>('');
  
  // New entry state
  const [newProductId, setNewProductId] = useState('');
  const [newShop, setNewShop] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newMarketer, setNewMarketer] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Search filter
  const filtered = mappings.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.productId.toLowerCase().includes(term) ||
      item.shop.toLowerCase().includes(term) ||
      item.shortName.toLowerCase().includes(term) ||
      item.marketerName.toLowerCase().includes(term)
    );
  });

  const handleStartEdit = (item: ProductMapping) => {
    setEditingId(item.productId);
    setEditProduct(item.productId);
    setEditShop(item.shop);
    setEditShortName(item.shortName);
    setEditMarketer(item.marketerName);
  };

  const handleSaveEdit = (oldId: string) => {
    if (!editProduct.trim()) {
      alert('产品ID不能为空');
      return;
    }
    
    // Check if new productId duplicates another existing key, if key was changed
    if (editProduct.trim() !== oldId && mappings.some(item => item.productId === editProduct.trim())) {
      alert('该产品ID已存在');
      return;
    }

    const updated = mappings.map(item => {
      if (item.productId === oldId) {
        return {
          productId: editProduct.trim(),
          shop: editShop.trim(),
          shortName: editShortName.trim(),
          marketerName: editMarketer.trim()
        };
      }
      return item;
    });

    setMappings(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm(`确认要删除此关联 mapping 吗？ID: ${id}`)) {
      setMappings(mappings.filter(item => item.productId !== id));
    }
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newProductId.trim()) {
      setErrorMsg('产品ID不能为空');
      return;
    }

    if (mappings.some(item => item.productId === newProductId.trim())) {
      setErrorMsg('该产品ID已在映射表中');
      return;
    }

    const newItem: ProductMapping = {
      productId: newProductId.trim(),
      shop: newShop.trim() || '通用店铺',
      shortName: newShortName.trim() || '通用商品',
      marketerName: newMarketer.trim() || '未设定人员'
    };

    setMappings([newItem, ...mappings]);
    setNewProductId('');
    setNewShop('');
    setNewShortName('');
    setNewMarketer('');
    setSuccessMsg('成功添加新商品关联记录！');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Bulk File Excel upload for Mappings
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);

        if (json.length === 0) {
          alert('表格内没有找到有效记录！');
          return;
        }

        // Detect required headers
        // Shop mapping column names
        const parsed: ProductMapping[] = [];
        let missingColumns = false;

        json.forEach((row, index) => {
          // Look for equivalent keys
          const keys = Object.keys(row);
          const shopKey = keys.find(k => k === '店铺' || k === '店铺名称');
          const pNameKey = keys.find(k => k === '产品简称' || k === '简称' || k === '商品简称');
          const nameKey = keys.find(k => k === '姓名' || k === '负责人' || k === '推手姓名');
          const idKey = keys.find(k => k === '产品ID' || k === '商品ID' || k === '商品id' || k === 'ID');

          if (!idKey || !shopKey || !pNameKey || !nameKey) {
            missingColumns = true;
          }

          if (idKey) {
            const rawId = String(row[idKey]).trim();
            // clean decimals
            const cleanId = rawId.includes('.') ? rawId.split('.')[0] : rawId;
            if (cleanId) {
              parsed.push({
                productId: cleanId,
                shop: shopKey ? String(row[shopKey] || '').trim() : '',
                shortName: pNameKey ? String(row[pNameKey] || '').trim() : '',
                marketerName: nameKey ? String(row[nameKey] || '').trim() : ''
              });
            }
          }
        });

        if (missingColumns && parsed.length === 0) {
          alert('列名不规范！请确保导入的Excel包含：【店铺】、【产品简称】、【姓名】、【产品ID】四个标题列。');
          return;
        }

        // De-duplicate parsed mapping
        const finalMap = [...mappings];
        let addedCount = 0;
        parsed.forEach(p => {
          const indexIdx = finalMap.findIndex(m => m.productId === p.productId);
          if (indexIdx >= 0) {
            // override
            finalMap[indexIdx] = p;
          } else {
            finalMap.push(p);
            addedCount++;
          }
        });

        setMappings(finalMap);
        alert(`合并解析成功！导入/更新了 ${parsed.length} 条记录（新增 ${addedCount} 条，覆盖 ${parsed.length - addedCount} 条）`);
      } catch (err: any) {
        alert('文件加载解析失败：' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Export current list to excel template
  const handleExportTemplate = () => {
    const headers = [['店铺', '产品简称', '姓名', '产品ID']];
    const data = mappings.map(m => [m.shop, m.shortName, m.marketerName, m.productId]);
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '映射配置模板');
    XLSX.writeFile(wb, '网店商品关联映射映射表.xlsx');
  };

  const handleLoadSample = () => {
    const samples: ProductMapping[] = [
      { productId: '665302919313', shop: '御尚品生活馆', shortName: '骨痛贴膏', marketerName: '王小伟' },
      { productId: '662094389101', shop: '御尚品生活馆', shortName: '蒸汽眼罩', marketerName: '陈美丽' },
      { productId: '654302911202', shop: '天美严选精选', shortName: '除湿袋', marketerName: '徐磊' },
      { productId: '587602339103', shop: '天美严选精选', shortName: '防爆热水袋', marketerName: '王小伟' },
      { productId: '694302919314', shop: '极客居家专营', shortName: '无痕衣架', marketerName: '李思思' },
      { productId: '612204389105', shop: '极客居家专营', shortName: '抽真空压缩袋', marketerName: '陈美丽' },
    ];
    setMappings(samples);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#111111] border border-white/10 p-6 rounded-none shadow-sm">
        <div className="text-left">
          <div className="text-[#38bdf8] text-[9px] font-bold tracking-[0.3em] uppercase mb-1">RELATIONSHIP MANAGER / 字典映射配置</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-[#38bdf8]" />
            <span>商品关联字典 (映射配置表)</span>
          </h2>
          <p className="text-white/50 text-xs mt-2 font-sans leading-relaxed">
            定义【产品 ID】对应的推广团队负责人姓名、开店名称、短名称简称。直通车与PDD销量核对将自动在此字典中获取对应负责人！
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            onClick={handleExportTemplate}
            className="cursor-pointer flex items-center gap-1.5 bg-white/5 hover:bg-white hover:text-black text-white px-3.5 py-2 rounded-none text-[10px] uppercase tracking-widest font-mono font-bold border border-white/10 transition-colors"
          >
            <Download className="w-4 h-4 text-[#38bdf8]" />
            <span>EXPORT DICTIONARY</span>
          </button>
          
          <label className="cursor-pointer flex items-center gap-1.5 bg-white/5 hover:bg-white hover:text-black text-white px-3.5 py-2 rounded-none text-[10px] uppercase tracking-widest font-mono font-bold border border-white/10 transition-colors">
            <FileUp className="w-4 h-4 text-[#38bdf8]" />
            <span>IMPORT DICTIONARY</span>
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

          <button
            onClick={handleLoadSample}
            className="cursor-pointer flex items-center gap-1 bg-white/5 hover:bg-white hover:text-black text-white px-3 py-2 rounded-none text-[10px] uppercase tracking-widest font-mono font-bold border border-white/10 transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>SEED DATA</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Panel */}
        <div className="bg-[#111111] border border-white/10 rounded-none p-5 space-y-4 shadow-sm h-fit">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#e0e0e0] pb-3 border-b border-white/10 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-[#38bdf8]" />
            <span>NEW RELATION / 新增关联纪录</span>
          </h3>

          <form onSubmit={handleAddNew} className="space-y-4 text-left font-sans">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 pl-1">PRODUCT ID / 产品数字 ID <span className="text-[#38bdf8]">*</span></label>
              <input
                type="text"
                placeholder="PROD ID e.g., 665302919313"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2.5 text-xs text-white placeholder-white/20 focus:border-[#38bdf8] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 pl-1">SHOP NAME / 经营店铺名称</label>
              <input
                type="text"
                placeholder="SHOP e.g., 御尚品生活馆"
                value={newShop}
                onChange={(e) => setNewShop(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2.5 text-xs text-white placeholder-white/20 focus:border-[#38bdf8] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 pl-1">SHORT CODENAME / 产品简称俗称</label>
              <input
                type="text"
                placeholder="SLUG e.g., 蒸汽眼罩"
                value={newShortName}
                onChange={(e) => setNewShortName(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2.5 text-xs text-white placeholder-white/20 focus:border-[#38bdf8] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 pl-1">ASSIGNED MARKETER / 负责人真实姓名</label>
              <input
                type="text"
                placeholder="NAME e.g., 陈美丽"
                value={newMarketer}
                onChange={(e) => setNewMarketer(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-none px-3 py-2.5 text-xs text-white placeholder-white/20 focus:border-[#38bdf8] focus:outline-none transition-colors"
              />
            </div>

            {errorMsg && (
              <p className="text-rose-400 text-xs px-3 py-2 bg-rose-500/5 border border-rose-500/10 rounded-none font-mono uppercase tracking-wider">
                ⚠️ {errorMsg}
              </p>
            )}

            {successMsg && (
              <p className="text-[#38bdf8] text-xs px-3 py-2 bg-[#38bdf8]/5 border border-[#38bdf8]/10 rounded-none font-mono uppercase tracking-wider">
                ✓ {successMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full cursor-pointer bg-white/5 hover:bg-white hover:text-black border border-white/10 text-white font-mono uppercase tracking-[0.2em] py-3 rounded-none text-[10px] transition-colors flex items-center justify-center gap-1"
            >
              <PlusCircle className="w-4 h-4" />
              <span>COMMIT ROW RECORD</span>
            </button>
          </form>
        </div>

        {/* Right Table Panel */}
        <div className="bg-[#111111] border border-white/10 rounded-none shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
          {/* Header Actions */}
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-black/20">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="GRID FILTER DIRECTORY: PRODID, NAME, SLUG, SHOP..."
                className="w-full bg-black/60 border border-white/10 rounded-none pl-10 pr-4 py-2 text-xs text-white focus:border-[#38bdf8] transition-colors outline-none tracking-wide text-left"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-[9px] font-mono tracking-widest uppercase"
                >
                  CLEAR
                </button>
              )}
            </div>
            
            <div className="shrink-0 text-white/40 text-[10px] font-bold bg-black/60 px-3 py-2 rounded-none border border-white/10 font-mono uppercase tracking-widest">
              Total Rows: <span className="text-white font-bold">{mappings.length}</span>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1 max-h-[500px]">
            {filtered.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <FileSpreadsheet className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-white/40 text-xs uppercase tracking-widest font-mono">No matching mappings deployed</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black/60 border-b border-white/10 text-white/40 uppercase font-semibold select-none font-mono tracking-widest text-[10px]">
                    <th className="py-3 px-4">产品 ID / SKU</th>
                    <th className="py-3 px-4">店铺</th>
                    <th className="py-3 px-4">产品俗名 (简称)</th>
                    <th className="py-3 px-4">负责人姓名</th>
                    <th className="py-3 px-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {filtered.map((item) => {
                    const isEditing = editingId === item.productId;
                    return (
                      <tr 
                        key={item.productId} 
                        className={`hover:bg-white/5 transition-colors ${
                          isEditing ? 'bg-[#38bdf8]/5' : ''
                        }`}
                      >
                        {/* Column ID */}
                        <td className="py-3 px-4 font-mono font-medium text-white/80">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProduct}
                              onChange={(e) => setEditProduct(e.target.value)}
                              className="bg-black/80 border border-white/10 rounded-none px-2 py-1 text-white font-mono w-full text-xs"
                            />
                          ) : (
                            <span>{item.productId}</span>
                          )}
                        </td>

                        {/* Column Shop */}
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editShop}
                              onChange={(e) => setEditShop(e.target.value)}
                              className="bg-black/80 border border-white/10 rounded-none px-2 py-1 text-white w-full text-xs"
                            />
                          ) : (
                            <span className="flex items-center gap-1.5 text-white/60">
                              <Building2 className="w-3.5 h-3.5 text-white/20" />
                              <span>{item.shop || '未指定'}</span>
                            </span>
                          )}
                        </td>

                        {/* Column Short */}
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editShortName}
                              onChange={(e) => setEditShortName(e.target.value)}
                              className="bg-black/80 border border-white/10 rounded-none px-2 py-1 text-white w-full text-xs"
                            />
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Tag className="w-3 sn-3 text-[#38bdf8]" />
                              <span className="text-white font-medium">{item.shortName || '未指定'}</span>
                            </span>
                          )}
                        </td>

                        {/* Column Marketer */}
                        <td className="py-3 px-4 font-medium">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editMarketer}
                              onChange={(e) => setEditMarketer(e.target.value)}
                              className="bg-black/80 border border-white/10 rounded-none px-2 py-1 text-white w-full text-xs"
                            />
                          ) : (
                            <span className="flex items-center gap-1.5 text-white">
                              <User className="w-3.5 h-3.5 text-pink-400" />
                              <span className="font-semibold">{item.marketerName || '未分配'}</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => handleSaveEdit(item.productId)}
                                className="p-1 px-2 bg-white/5 border border-white/10 hover:bg-white hover:text-black rounded-none text-white flex items-center justify-center transition-colors transition-all"
                                title="保存"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 px-2 bg-white/5 border border-white/10 hover:text-rose-400 rounded-none text-white/50 flex items-center justify-center transition-colors transition-all"
                                title="取消"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-center items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-1 hover:bg-white/5 text-white/40 hover:text-white rounded-none transition-colors"
                                title="编辑行内容"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.productId)}
                                className="p-1 hover:bg-rose-950/20 text-white/40 hover:text-rose-400 rounded-none transition-colors"
                                title="删除关联项"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="p-4 bg-black/60 border-t border-white/10 text-white/30 text-[10px] uppercase font-mono tracking-widest flex justify-between items-center select-none">
            <span>Supports bulk seed overwrite. Space and breaks cleared automatically.</span>
            {filtered.length !== mappings.length && (
              <span className="text-[#38bdf8] font-bold animate-pulse">Filtered: {filtered.length} / {mappings.length} items</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
