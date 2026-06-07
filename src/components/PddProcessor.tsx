import React, { useState, useRef } from 'react';
import { ProductMapping, PddProcessedProduct, FileInfo, IndividualSummary } from '../types';
import { 
  FileSpreadsheet, FileUp, Trash2, HelpCircle, AlertTriangle, 
  CheckCircle, Play, Download, Search, Info, TrendingUp, Sparkles, Filter 
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PddProcessorProps {
  globalMappings: ProductMapping[];
  onMappingsImported: (m: ProductMapping[]) => void;
  onPddDataUpdated: (data: PddProcessedProduct[], summaries: IndividualSummary[]) => void;
}

export default function PddProcessor({ globalMappings, onMappingsImported, onPddDataUpdated }: PddProcessorProps) {
  const [salesFiles, setSalesFiles] = useState<FileInfo[]>([]);
  const [parsing, setParsing] = useState(false);
  
  // Loaded sheets metadata for PDD-specific Config
  const [configFileName, setConfigFileName] = useState<string>('');
  const [configRecords, setConfigRecords] = useState<PddProcessedProduct[]>([]);
  const [productFullNamesMap, setProductFullNamesMap] = useState<{ [shortName: string]: string }>({});

  const salesFilesInputRef = useRef<HTMLInputElement>(null);
  const configFileRef = useRef<HTMLInputElement>(null);

  // Drag and Drop for PDD Order CSV logs
  const handleSalesDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleSalesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addSalesFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSalesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addSalesFiles(Array.from(e.target.files));
    }
  };

  const addSalesFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => f.name.endsWith('.csv'));
    if (validFiles.length === 0) {
      alert('拼多多原始订单数据通常是 CSV 格式，请导入您的 .csv 订单账目！');
      return;
    }

    const fileInfos: FileInfo[] = validFiles.map(f => ({
      name: f.name,
      size: f.size,
      status: 'pending'
    }));

    setSalesFiles(prev => [...prev, ...fileInfos]);
    processPddSales(validFiles);
  };

  const removeSalesFile = (idx: number) => {
    setSalesFiles(prev => prev.filter((_, i) => i !== idx));
    // Clear calculations or let user re-click Run
  };

  const clearSalesFiles = () => {
    setSalesFiles([]);
    if (salesFilesInputRef.current) salesFilesInputRef.current.value = '';
    setConfigRecords([]);
  };

  // 1. Parsing PDD config spreadsheet containing "组" worksheets & "数据" worksheet
  const handleConfigFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setConfigFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const extractedProducts: PddProcessedProduct[] = [];
        const extractedFullNames: { [shortName: string]: string } = {};

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(sheet);

          if (sheetName.includes('组')) {
            // Columns expected: 产品ID, 店铺, 产品简称, 姓名
            json.forEach(row => {
              const keys = Object.keys(row);
              const idKey = keys.find(k => k === '产品ID' || k === '商品ID' || k === '产品id' || k === '商品id' || k === 'ID');
              const shopKey = keys.find(k => k === '店铺' || k === '店铺名称');
              const shortKey = keys.find(k => k === '产品简称' || k === '简称' || k === '商品简称');
              const nameKey = keys.find(k => k === '姓名' || k === '负责人');

              if (idKey) {
                const rawId = String(row[idKey]).trim();
                const cleanId = rawId.includes('.') ? rawId.split('.')[0] : rawId;
                const pid = parseInt(cleanId);
                
                if (!isNaN(pid)) {
                  extractedProducts.push({
                    pid,
                    shortName: shortKey ? String(row[shortKey] || '').trim() : '',
                    pname: nameKey ? String(row[nameKey] || '').trim() : '',
                    shop: shopKey ? String(row[shopKey] || '').trim() : '',
                    group: sheetName,
                    shell_money: 0,
                    sd_money: 0,
                    wb_money: 0
                  });
                }
              }
            });
          } else if (sheetName.includes('数据')) {
            // Columns expected: 产品名称, 产品简称
            json.forEach(row => {
              const keys = Object.keys(row);
              const fullNameKey = keys.find(k => k === '产品名称' || k === '全称' || k === '商品名称');
              const shortKey = keys.find(k => k === '产品简称' || k === '简称' || k === '商品简称');

              if (fullNameKey && shortKey) {
                const sName = String(row[shortKey] || '').trim();
                const fName = String(row[fullNameKey] || '').trim();
                if (sName && fName) {
                  extractedFullNames[sName] = fName;
                }
              }
            });
          }
        });

        // Set configuration products inside states
        setConfigRecords(extractedProducts);
        setProductFullNamesMap(extractedFullNames);

        // Also sync back to global mappings so both sides benefit!
        const newGlobalMappings: ProductMapping[] = extractedProducts.map(p => ({
          productId: String(p.pid),
          shop: p.shop,
          shortName: p.shortName,
          marketerName: p.pname
        }));

        if (newGlobalMappings.length > 0) {
          onMappingsImported(newGlobalMappings);
        }

        alert(`配置文件解析成功！已提取 ${extractedProducts.length} 个配置商品归属于各【组】标签页。同时提取产品简称与全称配对 ${Object.keys(extractedFullNames).length} 条。`);
      } catch (err: any) {
        alert('解析配置文件失败: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Convert custom clean function
  const convertToNumeric = (value: any): number => {
    if (value === null || value === undefined) return 0;
    try {
      if (typeof value === 'number') return value;
      const strVal = String(value).replace(/[^\d.\-]/g, '').trim();
      const p = parseFloat(strVal);
      return isNaN(p) ? 0 : p;
    } catch {
      return 0;
    }
  };

  // 2. Run core transactional analytics matching the PDD operations logic
  const processPddSales = async (rawFiles: File[]) => {
    setParsing(true);
    
    // Fall back to global mapping products if custom config sheet hasn't been uploaded yet
    let activeConfigProducts = [...configRecords];
    if (activeConfigProducts.length === 0) {
      activeConfigProducts = globalMappings.map(m => ({
        pid: parseInt(m.productId),
        shortName: m.shortName,
        pname: m.marketerName,
        shop: m.shop,
        group: '默认业务组',
        shell_money: 0,
        sd_money: 0,
        wb_money: 0
      })).filter(p => !isNaN(p.pid));
    }

    if (activeConfigProducts.length === 0) {
      alert('请载入产品数据表格，或在【映射管理器】中录入商品关联后操作！');
      setParsing(false);
      return;
    }

    try {
      // Storage of parsed raw orders
      let allOrders: any[] = [];

      for (const file of rawFiles) {
        setSalesFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'processing' } : f));
        
        try {
          const contents = await readFileAsText(file);
          // Parse CSV to objects
          const rows = parseCsvToRows(contents);
          if (rows.length < 2) continue;

          // Header keys extraction
          const headers = rows[0].map(h => String(h).trim());
          const idIdx = headers.findIndex(h => h === '商品id' || h === '商品ID' || h === 'ID' || h === 'Id');
          const refundStatusIdx = headers.findIndex(h => h === '售后状态' || h === '退款状态');
          const orderStatusIdx = headers.findIndex(h => h === '订单状态');
          const realPriceIdx = headers.findIndex(h => h === '商家实收金额(元)' || h === '商家实收金额');
          const remarkIdx = headers.findIndex(h => h === '商家备注' || h === '备注');
          const serialNoIdx = headers.findIndex(h => h === '订单号' || h === '订单编号');

          if (idIdx === -1 || realPriceIdx === -1) {
            throw new Error('CSV文件列头缺失商品id或商家实收金额！');
          }

          let fileOrdersCount = 0;

          // Validate constraints
          // Valid Statuses:
          const validStatuses = ['无售后或售后取消', '售后处理中'];
          const validOrderStatuses = ['待发货', '已发货，待签收', '已发货，待收货', '已签收', '已收货'];

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const refundVal = refundStatusIdx !== -1 ? String(row[refundStatusIdx] || '').trim() : '无售后或售后取消';
            const orderStatusVal = orderStatusIdx !== -1 ? String(row[orderStatusIdx] || '').trim() : '已收货';
            
            // Check status constraints
            const refundPass = refundVal === '' || validStatuses.includes(refundVal);
            const orderPass = orderStatusVal === '' || validOrderStatuses.includes(orderStatusVal);

            if (refundPass && orderPass) {
              const pid = parseInt(String(row[idIdx]).trim());
              const price = convertToNumeric(row[realPriceIdx]);
              const remark = remarkIdx !== -1 ? String(row[remarkIdx] || '').trim() : '';
              const orderId = serialNoIdx !== -1 ? String(row[serialNoIdx] || '').trim() : String(i);

              if (!isNaN(pid)) {
                allOrders.push({
                  orderId,
                  pid,
                  price,
                  remark
                });
                fileOrdersCount++;
              }
            }
          }

          setSalesFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'success', rowCount: fileOrdersCount } : f));
        } catch (err: any) {
          setSalesFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: err.message } : f));
        }
      }

      // De-duplicate orders on "订单号" (orderId)
      const orderMap = new Map<string, any>();
      allOrders.forEach(o => {
        orderMap.set(o.orderId, o);
      });
      const uniqueOrders = Array.from(orderMap.values());

      // Batch aggregate calculations by Product ID
      const computedProducts = activeConfigProducts.map(prod => {
        const matchingOrders = uniqueOrders.filter(o => o.pid === prod.pid);
        
        let totalRevenue = 0;
        let sdMoney = 0; // G- / g-
        let wbMoney = 0; // V- / v-

        matchingOrders.forEach(o => {
          totalRevenue += o.price;

          // regex: substring matching
          const hasV = /v-|V-/.test(o.remark);
          const hasG = /g-|G-/.test(o.remark);

          if (hasV) {
            wbMoney += o.price;
          } else if (hasG) {
            sdMoney += o.price;
          }
        });

        const realSales = Math.max(totalRevenue - sdMoney - wbMoney, 0);

        return {
          ...prod,
          shell_money: parseFloat(realSales.toFixed(2)),
          sd_money: parseFloat(sdMoney.toFixed(2)),
          wb_money: parseFloat(wbMoney.toFixed(2)),
          fullName: productFullNamesMap[prod.shortName] || '未关联全称描述'
        };
      });

      // Filter products containing any transactions or non-zero outputs
      setConfigRecords(computedProducts);

      // Generate summaries for individuals & groups
      const summariesMap: { [name: string]: IndividualSummary } = {};
      computedProducts.forEach(prod => {
        const name = prod.pname || '未归类人员';
        if (!summariesMap[name]) {
          summariesMap[name] = {
            name,
            group: prod.group || '默认组',
            realSales: 0,
            sdSales: 0,
            wbSales: 0
          };
        }
        summariesMap[name].realSales += prod.shell_money;
        summariesMap[name].sdSales += prod.sd_money;
        summariesMap[name].wbSales += prod.wb_money;
      });

      const summaries = Object.values(summariesMap).map(s => ({
        ...s,
        realSales: parseFloat(s.realSales.toFixed(2)),
        sdSales: parseFloat(s.sdSales.toFixed(2)),
        wbSales: parseFloat(s.wbSales.toFixed(2))
      }));

      onPddDataUpdated(computedProducts, summaries);
      alert(`销售账目核对成功！一共核合 ${uniqueOrders.length} 条已成交有效商品订单。`);
    } catch (err: any) {
      alert('核算账目流程出错: ' + err.message);
    }

    setParsing(false);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'GB18030'); // CSV files exported from PDD are usually Chinese GB18030/GBK encoded!
    });
  };

  const parseCsvToRows = (text: string): any[][] => {
    const rows: any[][] = [];
    let currentRow: any[] = [];
    let insideQuote = false;
    let field = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          field += '"';
          i++; // Skip next quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        currentRow.push(field);
        field = '';
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
        currentRow.push(field);
        rows.push(currentRow);
        currentRow = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (field || currentRow.length > 0) {
      currentRow.push(field);
      rows.push(currentRow);
    }
    return rows;
  };

  // Multiple export tabs for parity with Python Sheet layout
  const handleExportCustomExcel = () => {
    if (configRecords.length === 0) {
      alert('未生成任何核对成果，核准账目后再导出！');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: 详细数据
      // Columns: 姓名, 组, 店铺, 产品ID, 产品简称, 产品全称, 真实销售额, 刷单, 放单
      const detailHeaders = [['姓名', '组', '店铺', '产品ID', '产品简称', '产品全称', '真实销售额', '刷单', '放单']];
      const detailData = configRecords.map(p => [
        p.pname || '',
        p.group || '',
        p.shop || '',
        p.pid,
        p.shortName || '',
        p.fullName || '无名称匹配',
        p.shell_money,
        p.sd_money,
        p.wb_money
      ]);
      const wsDetail = XLSX.utils.aoa_to_sheet([...detailHeaders, ...detailData]);

      // Set formats (Float formatting)
      const detailRange = XLSX.utils.decode_range(wsDetail['!ref'] || 'A1:A1');
      for (let r = 1; r <= detailRange.e.r; r++) {
        // ID Col to raw text
        const idCell = XLSX.utils.encode_cell({ r, c: 3 });
        if (wsDetail[idCell]) wsDetail[idCell].t = 's';

        // Money Cols to decimal formatted
        for (let c = 6; c <= 8; c++) {
          const moneyCell = XLSX.utils.encode_cell({ r, c });
          if (wsDetail[moneyCell] && typeof wsDetail[moneyCell].v === 'number') {
            wsDetail[moneyCell].z = '#,##0.00';
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, wsDetail, '详细数据');

      // Sheet 2: 汇总数据
      // Format requirements (Side-by-side matrices):
      // Col A-B: 姓名, 真实销售额
      // Col C-D: 店铺名称, 真实销售额
      // Col E-F: 产品简称, 真实销售额
      const nameSummary: { [name: string]: number } = {};
      const shopSummary: { [shop: string]: number } = {};
      const productSummary: { [shortName: string]: number } = {};

      configRecords.forEach(p => {
        const name = p.pname || '未归类姓名';
        const shop = p.shop || '未归类店铺';
        const prod = p.shortName || '未归类商品';

        nameSummary[name] = (nameSummary[name] || 0) + p.shell_money;
        shopSummary[shop] = (shopSummary[shop] || 0) + p.shell_money;
        productSummary[prod] = (productSummary[prod] || 0) + p.shell_money;
      });

      const sortedNames = Object.entries(nameSummary).sort((a, b) => a[0].localeCompare(b[0]));
      const sortedShops = Object.entries(shopSummary).sort((a, b) => a[0].localeCompare(b[0]));
      const sortedProducts = Object.entries(productSummary).sort((a, b) => a[0].localeCompare(b[0]));

      const maxRows = Math.max(sortedNames.length, sortedShops.length, sortedProducts.length);
      const summaryAOA: any[][] = [['姓名', '真实销售额', '店铺名称', '真实销售额', '产品简称', '真实销售额']];

      for (let i = 0; i < maxRows; i++) {
        const row: any[] = [];
        
        // Name Matrix
        if (i < sortedNames.length) {
          row.push(sortedNames[i][0], sortedNames[i][1]);
        } else {
          row.push('', '');
        }

        // Shop Matrix
        if (i < sortedShops.length) {
          row.push(sortedShops[i][0], sortedShops[i][1]);
        } else {
          row.push('', '');
        }

        // Product Matrix
        if (i < sortedProducts.length) {
          row.push(sortedProducts[i][0], sortedProducts[i][1]);
        } else {
          row.push('', '');
        }

        summaryAOA.push(row);
      }

      // Add Total sum row at the bottom
      const grandTotalRow: any[] = [];
      const sumNames = sortedNames.reduce((s, n) => s + n[1], 0);
      const sumShops = sortedShops.reduce((s, n) => s + n[1], 0);
      const sumProds = sortedProducts.reduce((s, n) => s + n[1], 0);

      grandTotalRow.push('姓名总计', sumNames, '店铺总计', sumShops, '产品简称总计', sumProds);
      summaryAOA.push([]); // blank spacing row in-between matching python
      summaryAOA.push(grandTotalRow);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
      
      // format decimal sizes
      const sumRange = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1:A1');
      for (let r = 1; r <= sumRange.e.r; r++) {
        [1, 3, 5].forEach(c => {
          const mCell = XLSX.utils.encode_cell({ r, c });
          if (wsSummary[mCell] && typeof wsSummary[mCell].v === 'number') {
            wsSummary[mCell].z = '#,##0.00';
          }
        });
      }

      XLSX.utils.book_append_sheet(wb, wsSummary, '汇总数据');

      // Save Workbook
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `拼多多PDD销量处理结果_${dateStr}.xlsx`);
    } catch (err: any) {
      alert('导出拼多多汇总文件失败: ' + err.message);
    }
  };

  // Metrics calculating
  const metricsTotReal = configRecords.reduce((sum, r) => sum + r.shell_money, 0);
  const metricsTotSD = configRecords.reduce((sum, r) => sum + r.sd_money, 0);
  const metricsTotWB = configRecords.reduce((sum, r) => sum + r.wb_money, 0);

  return (
    <div className="space-y-6">
      {/* Intro section */}
      <div className="bg-[#111111] border border-white/10 p-6 rounded-none shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#38bdf8]/5 rounded-full filter blur-3xl select-none pointer-events-none" />
        <div className="relative z-10 text-left">
          <div className="text-[#38bdf8] text-[9px] font-bold tracking-[0.3em] uppercase mb-1">AUDIT PIPELINE / 账目分摊体系</div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5.5 h-5.5 text-[#38bdf8]" />
            <span>拼多多（PDD）销售账目自动复核核算</span>
          </h2>
          <p className="text-white/50 text-xs mt-2 leading-relaxed max-w-4xl font-sans">
            用于核算并剥离拼多多销售总账。系统会合并去重所有 CSV 账期、判定并过滤非成交状态，并依商家备注进行自动筛选：
            <br />
            备注含有 <span className="text-[#38bdf8] font-bold font-mono text-[10px]">“G-”或“g-”</span> 归为刷单（SD）金额，
            含有 <span className="text-pink-400 font-bold font-mono text-[10px]">“V-”或“v-”</span> 归为放单/外包（WB）金额。
            自动计算 <strong className="text-white">真实销售额 = 实收总额 - 刷单金额 - 放单金额</strong>，确保财务核对精准至一厘。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Setup config & Upload orders */}
        <div className="space-y-5 lg:col-span-1">
          {/* Step 1: Config Product Sheet */}
          <div className="bg-[#111111] border border-white/10 rounded-none p-5 space-y-4 shadow-sm text-left">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#e0e0e0] pb-3 border-b border-white/10 flex items-center gap-2">
              <span className="w-5 h-5 bg-white/5 border border-white/10 text-[#38bdf8] flex items-center justify-center font-mono font-bold text-[10px]">1</span>
              <span>CONFIG SHEET / 载入配置划分</span>
            </h3>

            <div className="space-y-3">
              <p className="text-white/40 text-[11px] leading-relaxed">
                载入包含【组】标签页（如: 组1、组2）和【数据】标签页的 Excel，标签页内定义各组别的商品 ID 与人员配置。
              </p>

              {configFileName ? (
                <div className="bg-black/40 p-3 rounded-none border border-white/10 flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-[#38bdf8] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate" title={configFileName}>
                        {configFileName}
                      </p>
                      <p className="text-[9px] text-[#38bdf8] font-mono tracking-wider uppercase mt-0.5">
                        CONFIGURED: {configRecords.length} ITEMS
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setConfigFileName('');
                      setConfigRecords([]);
                    }}
                    className="p-1 hover:text-rose-450 text-white/30 rounded-none transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => configFileRef.current?.click()}
                    className="cursor-pointer w-full bg-white/5 hover:bg-white hover:text-black border border-white/10 text-white py-3 px-4 rounded-none text-[10px] uppercase tracking-widest font-mono font-bold transition-colors"
                  >
                    <FileUp className="w-4 h-4 text-[#38bdf8]" />
                    <span>LOAD CONFIG BOOK</span>
                  </button>
                  <span className="text-[9px] text-center text-white/30 block uppercase tracking-wider font-mono">
                    * Defaults to fallback database mapping
                  </span>
                </div>
              )}

              <input 
                type="file" 
                ref={configFileRef}
                onChange={handleConfigFileChange}
                accept=".xlsx,.xls"
                className="hidden" 
              />
            </div>
          </div>

          {/* Step 2: CSV Sales Log Bulk */}
          <div className="bg-[#111111] border border-white/10 rounded-none p-5 space-y-4 shadow-sm text-left">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#e0e0e0] pb-3 border-b border-white/10 flex items-center gap-2">
              <span className="w-5 h-5 bg-white/5 border border-white/10 text-[#38bdf8] flex items-center justify-center font-mono font-bold text-[10px]">2</span>
              <span>RAW DATA STREAMS / 拼多多流水</span>
            </h3>

            <div 
              onDragOver={handleSalesDragOver}
              onDrop={handleSalesDrop}
              onClick={() => salesFilesInputRef.current?.click()}
              className="border border-dashed border-white/10 hover:border-[#38bdf8]/40 bg-black/40 hover:bg-white/5 rounded-none p-6 text-center transition-all cursor-pointer group flex flex-col justify-center items-center py-5"
            >
              <FileUp className="w-8 h-8 text-white/20 group-hover:text-[#38bdf8] transition-colors mb-2 duration-150" />
              <span className="text-xs uppercase tracking-wider text-white">DROP CSV SALES STREAM</span>
              <p className="text-white/40 text-[10px] mt-2 whitespace-normal">
                支持多 CSV 并排去重统计
              </p>
              <input 
                type="file"
                ref={salesFilesInputRef}
                onChange={handleSalesFileChange}
                multiple 
                accept=".csv"
                className="hidden"
              />
            </div>

            {/* CSV logs matching files block */}
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {salesFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-none text-left text-[11px]">
                  <span className="truncate text-white/80 font-medium flex-1 pr-2" title={file.name}>
                    {file.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {file.status === 'success' && (
                      <span className="text-[9px] text-[#38bdf8] bg-[#38bdf8]/10 px-1.5 py-0.5 rounded-none border border-[#38bdf8]/20 font-mono">{file.rowCount} ROWS</span>
                    )}
                    {file.status === 'processing' && (
                      <div className="w-3 h-3 border border-[#38bdf8]/30 border-t-[#38bdf8] rounded-full animate-spin" />
                    )}
                    <button 
                      onClick={() => removeSalesFile(idx)}
                      className="text-white/30 hover:text-rose-400 p-0.5 rounded-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {salesFiles.length > 0 && (
              <button
                onClick={clearSalesFiles}
                className="cursor-pointer w-full text-white/40 hover:text-rose-400 text-[10px] text-center font-mono uppercase tracking-widest block"
              >
                CLEAR ALL SALES STREAMS
              </button>
            )}
          </div>
        </div>

        {/* Right column: Results data visualization */}
        <div className="lg:col-span-2 space-y-5 flex flex-col">
          {/* Dashboard KPI matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#111111] border border-white/10 p-5 rounded-none shadow-sm text-left">
              <span className="text-white/40 text-[9px] font-semibold tracking-[0.2em] uppercase block">REAL SALES / 真实纯销售</span>
              <p className="text-xl font-light text-white tracking-tight mt-1.5 animate-pulse">
                <span className="text-sm font-normal text-white/30 mr-1 italic">¥</span>
                {metricsTotReal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
              <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest mt-2">
                Stripped SD and WB segments
              </div>
            </div>

            <div className="bg-[#111111] border border-white/10 p-5 rounded-none shadow-sm text-left">
              <span className="text-white/40 text-[9px] font-semibold tracking-[0.2em] uppercase block">SD REVENUE / 刷单流水</span>
              <p className="text-xl font-light text-[#38bdf8] tracking-tight mt-1.5">
                <span className="text-sm font-normal text-white/30 mr-1 italic">¥</span>
                {metricsTotSD.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
              <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest mt-2">
                Memo matches G- / g-
              </div>
            </div>

            <div className="bg-[#111111] border border-white/10 p-5 rounded-none shadow-sm text-left">
              <span className="text-white/40 text-[9px] font-semibold tracking-[0.2em] uppercase block">WB OUTSOURCED / 外包放单</span>
              <p className="text-xl font-light text-pink-400 tracking-tight mt-1.5">
                <span className="text-sm font-normal text-white/30 mr-1">¥</span>
                {metricsTotWB.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
              <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest mt-2">
                Memo matches V- / v-
              </div>
            </div>
          </div>

          {/* Results table panel */}
          <div className="bg-[#111111] border border-white/10 rounded-none shadow-sm flex-1 flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-white/10 bg-black/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest font-mono">
                PDD LEDGER STREAM / 拼多多销售复核 ({configRecords.length} RECORDS)
              </span>

              {configRecords.length > 0 && (
                <button
                  onClick={handleExportCustomExcel}
                  className="cursor-pointer bg-white/5 hover:bg-white hover:text-black text-white border border-white/10 uppercase tracking-[0.2em] font-mono text-[10px] px-4 py-2 rounded-none transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>EXPORT COMPLEX SPREADSHEET</span>
                </button>
              )}
            </div>

            {/* Scrollable table contents */}
            <div className="overflow-x-auto flex-1 max-h-[450px]">
              {configRecords.length === 0 ? (
                <div className="py-24 text-center">
                  <FileSpreadsheet className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">PDD Output Terminal</h4>
                  <p className="text-[11px] text-white/40 max-w-sm mx-auto mt-2 leading-relaxed font-sans">
                    请在左侧载入商品配置表（或直接使用映射表），并导入拼多多订单流水，开始精细的财务流水分账审计。
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="bg-black/60 border-b border-white/10 text-white/40 uppercase font-semibold select-none font-mono tracking-widest text-[10px]">
                      <th className="py-3 px-4">团队成员</th>
                      <th className="py-3 px-4">所属组别</th>
                      <th className="py-3 px-4">产品ID码</th>
                      <th className="py-3 px-4">店铺</th>
                      <th className="py-3 px-4">产品简称</th>
                      <th className="py-3 px-4 text-right">真实销售额</th>
                      <th className="py-3 px-4 text-right text-[#38bdf8]">刷单(SD)</th>
                      <th className="py-3 px-4 text-right text-pink-400">放单(WB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {configRecords.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-4 text-white font-semibold flex items-center gap-1.5 font-sans">
                          <span className="w-1 h-1 bg-[#38bdf8] shrink-0" />
                          <span>{item.pname || '未归类负责人'}</span>
                        </td>
                        <td className="py-2.5 px-4 text-white/40 font-mono text-[11px] uppercase">{item.group}</td>
                        <td className="py-2.5 px-4 text-white/60 font-mono">{item.pid}</td>
                        <td className="py-2.5 px-4 text-white/60">{item.shop}</td>
                        <td className="py-2.5 px-4 text-white font-semibold">{item.shortName}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-white">
                          ¥{item.shell_money.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[#38bdf8]">
                          ¥{item.sd_money.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-pink-400">
                          ¥{item.wb_money.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-black/60 border-t border-white/10 text-[10px] text-white/40 flex justify-between items-center select-none font-mono uppercase tracking-widest">
              <span>Audited items: <strong className="text-white font-bold">{configRecords.length}</strong></span>
              <span>
                Net aggregates: <strong className="text-[#38bdf8] font-bold">¥{metricsTotReal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
