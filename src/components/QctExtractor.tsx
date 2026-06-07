import React, { useState, useRef } from 'react';
import { ProductMapping, QctRecord, FileInfo } from '../types';
import { 
  FileSpreadsheet, FileUp, Trash2, HelpCircle, AlertTriangle, 
  CheckCircle, Play, Download, Search, Info, TrendingUp, Sparkles, Filter 
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface QctExtractorProps {
  mappings: ProductMapping[];
  onQctDataUpdated: (data: QctRecord[]) => void;
}

export default function QctExtractor({ mappings, onQctDataUpdated }: QctExtractorProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [records, setRecords] = useState<QctRecord[]>([]);
  const [parsing, setParsing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMarketer, setFilterMarketer] = useState('ALL');
  const [filterShop, setFilterShop] = useState('ALL');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    addFiles(droppedFiles);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validExtensions = ['.xlsx', '.xls', '.csv', '.xlsm'];
    const filteredFiles = newFiles.filter(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return validExtensions.includes(ext);
    });

    if (filteredFiles.length === 0) {
      alert('请载入有效的 Excel (.xlsx, .xls, .xlsm) 或 CSV 文件！');
      return;
    }

    const fileInfos: FileInfo[] = filteredFiles.map(f => ({
      name: f.name,
      size: f.size,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...fileInfos]);

    // Keep the raw File objects linked or process immediately
    processFiles(filteredFiles);
  };

  const removeFile = (idx: number, name: string) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setRecords(prev => prev.filter(r => !r.productName.startsWith(`[${name}]`))); // Clear records from this file if cached
  };

  const clearAll = () => {
    setFiles([]);
    setRecords([]);
    onQctDataUpdated([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cleaning strategy matches Python excel column parsing precisely
  const cleanProductId = (value: any): string => {
    if (value === null || value === undefined) return '';
    try {
      let strVal = String(value).trim();
      
      // Match number sequence like Python re.search(r'(\d+)', value)
      const match = strVal.match(/(\d+)/);
      if (match) {
        return match[1];
      }
      // If it contains float decimals (e.g., 6653.0) strip decimal point
      if (strVal.includes('.')) {
        return strVal.split('.')[0];
      }
      return strVal;
    } catch {
      return String(value);
    }
  };

  const cleanCost = (value: any): number => {
    if (value === null || value === undefined) return 0;
    try {
      if (typeof value === 'number') return value;
      const str = String(value)
        .replace(/¥/g, '')
        .replace(/￥/g, '')
        .replace(/\$/g, '')
        .replace(/,/g, '')
        .replace(/\s/g, '')
        .trim();
      if (!str) return 0;
      const parsed = parseFloat(str);
      return isNaN(parsed) ? 0 : parsed;
    } catch {
      return 0;
    }
  };

  const processFiles = async (rawFiles: File[]) => {
    setParsing(true);
    let allExtractedRecords: QctRecord[] = [];

    for (const file of rawFiles) {
      // Find index in files state to update status
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'processing' } : f));

      try {
        const data = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(data, { type: 'array' });
        let fileRowsCount = 0;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          // Get matrix structure
          const sheetJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (sheetJson.length < 2) continue;

          // Look for matching columns in the first 30 rows (like Python start_row: 1, max_row: 30)
          let colIndices = {
            productId: -1,
            productName: -1,
            promoName: -1,
            spend: -1
          };

          // Columns we search for (consistent with python targets)
          const targetProductId = ['商品ID', '商品id', '产品ID', '链接ID', '链接id', 'ID', 'Id'];
          const targetProductName = ['商品名称', '标题', '商品标题', '商品名称/规格'];
          const targetPromoName = ['推广名称', '计划名称', '推广计划', '推广专员'];
          const targetSpend = ['成交花费(元)', '消耗', '花费', '成交花费', '推广费用', '广告费用'];

          let headerRowIdx = -1;

          // Find header row with highest concentration of matches
          for (let r = 0; r < Math.min(sheetJson.length, 30); r++) {
            const row = sheetJson[r];
            if (!row || row.length === 0) continue;

            const rowStr = row.map(cell => String(cell || '').trim());
            
            const pIdIdx = rowStr.findIndex(cell => targetProductId.some(t => cell.includes(t) || t === cell));
            const pNameIdx = rowStr.findIndex(cell => targetProductName.some(t => cell.includes(t) || t === cell));
            const pPromoIdx = rowStr.findIndex(cell => targetPromoName.some(t => cell.includes(t) || t === cell));
            const pSpendIdx = rowStr.findIndex(cell => targetSpend.some(t => cell.includes(t) || t === cell));

            if (pIdIdx !== -1 && pSpendIdx !== -1) {
              colIndices = {
                productId: pIdIdx,
                productName: pNameIdx !== -1 ? pNameIdx : 1, // Fallback index B based on Python strategy
                promoName: pPromoIdx !== -1 ? pPromoIdx : 3,  // Fallback index D 
                spend: pSpendIdx
              };
              headerRowIdx = r;
              break;
            }
          }

          // If header wasn't found smoothly, use default indexing: A -> ID, B -> Name, D -> Promo, H -> Cost
          if (headerRowIdx === -1) {
            colIndices = {
              productId: 0,   // A
              productName: 1, // B
              promoName: 3,   // D
              spend: 7        // H (index 7 is column H)
            };
            headerRowIdx = 0;
          }

          // Parse records below header row
          for (let r = headerRowIdx + 1; r < sheetJson.length; r++) {
            const row = sheetJson[r];
            if (!row || row.length === 0) continue;

            const rawId = row[colIndices.productId];
            const spendVal = row[colIndices.spend];
            
            // Clean product ID and spend
            const id = cleanProductId(rawId);
            const spendFloat = cleanCost(spendVal);

            // Filter out outlier headers (A-col containing "总计" or "注", etc. or zero spends)
            if (!id || id.includes('总计') || id.includes('注') || spendFloat === 0) {
              continue; // Filter row
            }

            // Mappings look-up
            const matchedMapping = mappings.find(m => m.productId === id);

            allExtractedRecords.push({
              productId: id,
              productName: colIndices.productName !== -1 ? String(row[colIndices.productName] || '').trim() : '',
              promoName: colIndices.promoName !== -1 ? String(row[colIndices.promoName] || '').trim() : '',
              spend: spendFloat,
              marketerName: matchedMapping ? matchedMapping.marketerName : '',
              shop: matchedMapping ? matchedMapping.shop : '',
              shortName: matchedMapping ? matchedMapping.shortName : ''
            });

            fileRowsCount++;
          }
        }

        // Set file as processed successfully
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'success', rowCount: fileRowsCount } : f));
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: err.message } : f));
      }
    }

    setRecords(prev => {
      // Merge with de-duplication if same file name records are re-imported
      const updated = [...prev, ...allExtractedRecords];
      onQctDataUpdated(updated);
      return updated;
    });

    setParsing(false);
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  };

  // Calculations
  const statsTotalSpend = records.reduce((sum, r) => sum + r.spend, 0);
  const statsUniqueProducts = new Set(records.map(r => r.productId)).size;
  const statsMatedPercent = records.length > 0
    ? Math.round((records.filter(r => r.marketerName).length / records.length) * 100)
    : 0;

  // Filter lists configuration
  const uniqueMarketers = Array.from(new Set(records.map(r => r.marketerName).filter(Boolean)));
  const uniqueShops = Array.from(new Set(records.map(r => r.shop).filter(Boolean)));

  // Filter application
  const filteredRecords = records.filter(item => {
    const textMatch = searchTerm.trim().toLowerCase();
    
    // search text filters
    const searchPass = !textMatch || (
      item.productId.includes(textMatch) ||
      item.productName.toLowerCase().includes(textMatch) ||
      item.promoName.toLowerCase().includes(textMatch) ||
      item.marketerName.toLowerCase().includes(textMatch) ||
      item.shop.toLowerCase().includes(textMatch) ||
      item.shortName.toLowerCase().includes(textMatch)
    );

    const marketerPass = filterMarketer === 'ALL' || item.marketerName === filterMarketer || (filterMarketer === 'UNMATCHED' && !item.marketerName);
    const shopPass = filterShop === 'ALL' || item.shop === filterShop || (filterShop === 'UNMATCHED' && !item.shop);

    return searchPass && marketerPass && shopPass;
  });

  // Export integrated excel book (Matches exactly the Python sheets format)
  const handleExportConsolidatedExcel = () => {
    if (records.length === 0) {
      alert('无可导出的解析数据，请先上传直通车推广花费报表进行解析！');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: 汇总数据
      // Headers: 商品ID, 姓名, 店铺, 产品简称, 商品名称, 推广名称, 成交花费(元)
      const detailHeaders = [['商品ID', '姓名', '店铺', '产品简称', '商品名称', '推广名称', '成交花费(元)']];
      const detailData = records.map(r => [
        r.productId,
        r.marketerName || '',
        r.shop || '',
        r.shortName || '',
        r.productName,
        r.promoName,
        r.spend
      ]);
      const wsDetail = XLSX.utils.aoa_to_sheet([...detailHeaders, ...detailData]);

      // format number spend values as float with 2 decimal points
      const recordRange = XLSX.utils.decode_range(wsDetail['!ref'] || 'A1:A1');
      for (let r = 1; r <= recordRange.e.r; r++) {
        // ID column to text format
        const idCellRef = XLSX.utils.encode_cell({ r, c: 0 });
        if (wsDetail[idCellRef]) {
          wsDetail[idCellRef].t = 's'; // string type explicitly
        }

        // Spend column to number layout
        const spendCellRef = XLSX.utils.encode_cell({ r, c: 6 });
        const cellVal = wsDetail[spendCellRef];
        if (cellVal && typeof cellVal.v === 'number') {
          cellVal.z = '#,##0.00'; // number format
        }
      }

      XLSX.utils.book_append_sheet(wb, wsDetail, '汇总数据');

      // Sheet 2: 姓名汇总
      // Headers: 姓名, 真实销售额 (This represents marketing spend summed per user based on Python logic)
      const summaryMap: { [name: string]: number } = {};
      records.forEach(r => {
        const name = r.marketerName || '未关联人员';
        summaryMap[name] = (summaryMap[name] || 0) + r.spend;
      });

      const summaryHeaders = [['姓名', '真实销售额']];
      const summaryData = Object.keys(summaryMap)
        .sort()
        .map(name => [name, summaryMap[name]]);

      const wsSummary = XLSX.utils.aoa_to_sheet([...summaryHeaders, ...summaryData]);

      // set format
      const summaryRange = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1:A1');
      for (let r = 1; r <= summaryRange.e.r; r++) {
        const spendCellRef = XLSX.utils.encode_cell({ r, c: 1 });
        const cellVal = wsSummary[spendCellRef];
        if (cellVal && typeof cellVal.v === 'number') {
          cellVal.z = '#,##0.00';
        }
      }

      XLSX.utils.book_append_sheet(wb, wsSummary, '姓名汇总');

      // Write File
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `直通车QCT数据提取结果_${dateStr}.xlsx`);
    } catch (err: any) {
      alert('导出汇总Excel文件失败: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro info card */}
      <div className="bg-[#111111] border border-white/10 p-6 rounded-none shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#38bdf8]/5 rounded-full filter blur-3xl select-none pointer-events-none" />
        <div className="relative z-10 text-left">
          <div className="text-[#38bdf8] text-[9px] font-bold tracking-[0.3em] uppercase mb-1">DATA PROCESSING / 数据作业核心</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5.5 h-5.5 text-[#38bdf8]" />
            <span>直通车推广花费数据提取</span>
          </h2>
          <p className="text-white/50 text-xs mt-2 leading-relaxed max-w-4xl font-sans">
            批量归集直通车导出的报表文件。系统会自动解析表格查找列
            <strong className="text-[#38bdf8]">【商品ID】、【商品名称】、【推广名称】、【成交花费(元)】</strong>，
            清洗无效字符或空值，结合已配置的映射关系表格，智能合并出含有负责人信息的结算账目，最后按姓名归属求和，便于财务作业！
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Drag and Drop & File Status Queue */}
        <div className="space-y-5 lg:col-span-1">
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-white/10 hover:border-[#38bdf8]/40 bg-black/40 hover:bg-white/5 rounded-none p-6 text-center transition-all cursor-pointer group flex flex-col justify-center items-center py-10"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple 
              className="hidden" 
              accept=".xlsx,.xls,.xlsm,.csv"
            />
            <FileUp className="w-10 h-10 text-white/20 group-hover:text-[#38bdf8] transition-colors mb-4 duration-200" />
            <h3 className="text-xs uppercase tracking-[0.2em] text-white">
              LOAD STREAM / 导入直通车账簿
            </h3>
            <p className="text-white/40 text-[11px] mt-2 pr-2 pl-2">
              拖拽或点击本区域。支持批量载入 excel / csv 格式推广报告数据。
            </p>
            <span className="mt-4 px-3 py-1 bg-white/5 text-[9px] text-[#38bdf8] font-mono tracking-widest rounded-none border border-white/10 uppercase">
              MULTIPART QUEUE
            </span>
          </div>

          {/* Files queue status */}
          <div className="bg-[#111111] border border-white/10 rounded-none p-5 flex flex-col min-h-[220px]">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <span className="text-[10px] uppercase tracking-widest text-[#e0e0e0] font-bold">
                QUEUE / 作业队列 ({files.length})
              </span>
              {files.length > 0 && (
                <button 
                  onClick={clearAll}
                  className="cursor-pointer text-[9px] uppercase tracking-wider text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 bg-rose-500/5 px-2 py-1.5 rounded-none border border-rose-500/10"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>CLEAR QUEUE</span>
                </button>
              )}
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px]">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/20 text-xs">
                  <FileSpreadsheet className="w-8 h-8 opacity-20 mb-2" />
                  <span className="text-[10px] uppercase tracking-widest">No active payload</span>
                </div>
              ) : (
                files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-none text-left text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                       <FileSpreadsheet className="w-5 h-5 text-[#38bdf8]/80 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-white font-medium text-[11px]" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[9px] text-white/30 font-mono uppercase tracking-wider mt-0.5">
                          SIZE: {(file.size / 1024).toFixed(1)} KB 
                          {file.rowCount !== undefined && ` • ROW: ${file.rowCount}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {file.status === 'pending' && (
                        <span className="text-[9px] uppercase tracking-wider text-white/40 bg-white/5 px-1.5 py-0.5 rounded-none border border-white/10">WAIT</span>
                      )}
                      {file.status === 'processing' && (
                        <div className="w-3.5 h-3.5 border-2 border-[#38bdf8]/30 border-t-[#38bdf8] rounded-full animate-spin" />
                      )}
                      {file.status === 'success' && (
                        <span className="text-[9px] uppercase tracking-wider text-[#38bdf8] bg-[#38bdf8]/10 px-1.5 py-0.5 rounded-none border border-[#38bdf8]/20">READY</span>
                      )}
                      {file.status === 'error' && (
                        <span className="text-[9px] uppercase tracking-wider text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-none border border-rose-500/20" title={file.errorMessage}>ERR</span>
                      )}
                      <button 
                        onClick={() => removeFile(idx, file.name)}
                        className="p-1 text-white/30 hover:text-rose-400 rounded-none hover:bg-white/5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Consolidated outputs and metrics */}
        <div className="lg:col-span-2 space-y-5 flex flex-col">
          {/* Key Metrics row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#111111] border border-white/10 p-5 rounded-none shadow-sm text-left">
              <span className="text-white/40 text-[9px] font-semibold tracking-[0.2em] uppercase block">COST SUM / 开销总计</span>
              <p className="text-xl font-light text-white tracking-tight mt-1.5">
                <span className="text-sm font-normal text-white/30 mr-1 italic">¥</span>
                {statsTotalSpend.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest mt-2">
                Click aggregate sum
              </div>
            </div>

            <div className="bg-[#111111] border border-white/10 p-5 rounded-none shadow-sm text-left">
              <span className="text-white/40 text-[9px] font-semibold tracking-[0.2em] uppercase block">PRODUCTS / 商品大类</span>
              <p className="text-xl font-light text-[#38bdf8] tracking-tight mt-1.5">
                {statsUniqueProducts} <span className="text-[10px] font-mono text-white/40">SKU INSTANCES</span>
              </p>
              <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest mt-2">
                Unique product ids identified
              </div>
            </div>

            <div className="bg-[#111111] border border-white/10 p-5 rounded-none shadow-sm text-left relative overflow-hidden">
              <div className={`absolute right-2 top-2 w-1.5 h-1.5 rounded-full ${statsMatedPercent === 100 ? 'bg-[#38bdf8]' : statsMatedPercent > 70 ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="text-white/40 text-[9px] font-semibold tracking-[0.2em] uppercase block">MATCH RATE / 映射比率</span>
              <p className="text-xl font-bold text-white tracking-tight mt-1.5">
                {statsMatedPercent}%
              </p>
              <div className="text-[9px] mt-2 uppercase tracking-wide font-mono">
                {statsMatedPercent === 0 ? (
                  <span className="text-white/30">No matchups assigned</span>
                ) : statsMatedPercent < 100 ? (
                  <span className="text-amber-500 font-bold">Incomplete references</span>
                ) : (
                  <span className="text-[#38bdf8] font-bold">100% matched fully</span>
                )}
              </div>
            </div>
          </div>

          {/* Results Table Section */}
          <div className="bg-[#111111] border border-white/10 rounded-none shadow-sm flex-1 flex flex-col min-h-[400px]">
            {/* Toolbar for records list */}
            <div className="p-4 border-b border-white/10 bg-black/20 flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="QUERY MATRIX: ID, TITLE, OR MARKETER..."
                  className="w-full bg-black/60 border border-white/10 rounded-none pl-10 pr-4 py-2 text-xs text-white focus:border-[#38bdf8] transition-colors outline-none tracking-wide"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Marketer Filter */}
                <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-none px-3 py-2 text-xs text-white/50 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <select 
                    value={filterMarketer} 
                    onChange={(e) => setFilterMarketer(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none cursor-pointer text-[11px] uppercase tracking-wider"
                  >
                    <option value="ALL">All Marketers / 全部负责人</option>
                    <option value="UNMATCHED">Unmapped / 未关联</option>
                    {uniqueMarketers.map(m => (
                      <option key={m} value={m} className="bg-[#111] text-white">{m}</option>
                    ))}
                  </select>
                </div>

                {/* Shop Filter */}
                <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-none px-3 py-2 text-xs text-white/50 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <select 
                    value={filterShop} 
                    onChange={(e) => setFilterShop(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none cursor-pointer text-[11px] uppercase tracking-wider"
                  >
                    <option value="ALL">All Shops / 所有店铺</option>
                    <option value="UNMATCHED">Unmapped / 未配置</option>
                    {uniqueShops.map(s => (
                      <option key={s} value={s} className="bg-[#111] text-white">{s}</option>
                    ))}
                  </select>
                </div>

                {records.length > 0 && (
                  <button
                    onClick={handleExportConsolidatedExcel}
                    className="cursor-pointer bg-white/5 hover:bg-white hover:text-black text-white border border-white/10 uppercase tracking-[0.2em] font-mono text-[10px] px-4 py-2 rounded-none transition-colors duration-150 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT SPREADSHEET</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table layout */}
            <div className="overflow-x-auto flex-1 max-h-[420px]">
              {records.length === 0 ? (
                <div className="py-24 text-center">
                  <FileSpreadsheet className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">QCT Preview Terminal</h4>
                  <p className="text-[11px] text-white/40 max-w-sm mx-auto mt-2 leading-relaxed">
                    请在左翼部署直通车账目表格文件。解析后，系统将依凭 ID 规则联动映射表，展示详细对账表。
                  </p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-20 text-center">
                  <Info className="w-10 h-10 text-white/10 mx-auto mb-2" />
                  <p className="text-white/40 text-xs uppercase tracking-widest font-mono">No matching streams located</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/60 border-b border-white/10 text-white/40 uppercase font-semibold select-none font-mono tracking-widest text-[10px]">
                      <th className="py-3 px-4">商品 ID</th>
                      <th className="py-3 px-4">店铺</th>
                      <th className="py-3 px-4">产品俗名</th>
                      <th className="py-3 px-4">Marketer 负责人</th>
                      <th className="py-3 px-4">推广计划</th>
                      <th className="py-3 px-4 text-right">花费(元)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {filteredRecords.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-medium text-white/80">
                          {item.productId}
                        </td>
                        <td className="py-2.5 px-4 text-white/60">
                          {item.shop ? (
                            <span>{item.shop}</span>
                          ) : (
                            <span className="text-rose-400 font-semibold flex items-center gap-1 font-mono text-[10px] uppercase">
                              <AlertTriangle className="w-3 w-3 inline shrink-0" /> UNMAPPED_SHOP
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-white">
                          {item.shortName ? (
                            <span className="bg-white/5 text-[#38bdf8] border border-white/10 px-2 py-0.5 rounded-none font-mono text-[10px]">
                              {item.shortName}
                            </span>
                          ) : (
                            <span className="text-white/20 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-medium">
                          {item.marketerName ? (
                            <span className="text-white font-semibold">{item.marketerName}</span>
                          ) : (
                            <span className="text-rose-400 py-0.5 bg-rose-500/5 border border-rose-500/15 text-[9px] uppercase tracking-wider font-mono px-1.5 rounded-none" title="需要映射管理器添加本产品关联">
                              NOT_ASSIGNED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-white/40 truncate max-w-[150px]" title={item.promoName}>
                          {item.promoName}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-white">
                          ¥{item.spend.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-black/60 border-t border-white/10 text-[10px] text-white/40 flex justify-between items-center select-none font-mono uppercase tracking-widest">
              <span>Selected Rows: <strong className="text-white font-bold">{filteredRecords.length}</strong></span>
              <span>Subtotal: <strong className="text-[#38bdf8] font-bold">¥{filteredRecords.reduce((sum, r) => sum + r.spend, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
