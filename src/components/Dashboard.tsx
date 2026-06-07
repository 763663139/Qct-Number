import React, { useState } from 'react';
import { ProductMapping, QctRecord, PddProcessedProduct, IndividualSummary } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell, AreaChart, Area, PieChart, Pie
} from 'recharts';
import { 
  Building2, Users, Receipt, CircleDollarSign, Percent, 
  ChevronRight, ArrowUpRight, Award, Flame, Library, Play, HelpCircle
} from 'lucide-react';

interface DashboardProps {
  mappings: ProductMapping[];
  qctRecords: QctRecord[];
  pddRecords: PddProcessedProduct[];
  pddSummaries: IndividualSummary[];
}

export default function Dashboard({ mappings, qctRecords, pddRecords, pddSummaries }: DashboardProps) {
  const [useFakeData, setUseFakeData] = useState(qctRecords.length === 0 && pddRecords.length === 0);

  // Generate mock details to make dashboard stunning on startup
  const mockQctRecords: QctRecord[] = [
    { productId: '665302919313', productName: '骨痛贴膏', promoName: '骨痛计划A', spend: 45000, marketerName: '王小伟', shop: '御尚品生活馆', shortName: '骨痛贴膏' },
    { productId: '662094389101', productName: '蒸汽眼罩', promoName: '蒸汽推广通', spend: 23200, marketerName: '陈美丽', shop: '御尚品生活馆', shortName: '蒸汽眼罩' },
    { productId: '654302911202', productName: '除湿袋', promoName: '除湿超值版', spend: 18450, marketerName: '徐磊', shop: '天美严选精选', shortName: '除湿袋' },
    { productId: '587602339103', productName: '防爆热水袋', promoName: '热水袋冬推', spend: 12100, marketerName: '王小伟', shop: '天美严选精选', shortName: '防爆热水袋' },
    { productId: '612204389105', productName: '抽真空压缩袋', promoName: '抽真空超值专推', spend: 9800, marketerName: '陈美丽', shop: '极客居家专营', shortName: '抽真空压缩袋' },
    { productId: '694302919314', productName: '无痕衣架', promoName: '衣架精推', spend: 6400, marketerName: '李思思', shop: '极客居家专营', shortName: '无痕衣架' },
  ];

  const mockPddRecords: PddProcessedProduct[] = [
    { pid: 665302919313, shortName: '骨痛贴膏', pname: '王小伟', shop: '御尚品生活馆', group: '一组', shell_money: 184000, sd_money: 12000, wb_money: 23000 },
    { pid: 662094389101, shortName: '蒸汽眼罩', pname: '陈美丽', shop: '御尚品生活馆', group: '二组', shell_money: 94800, sd_money: 5000, wb_money: 12000 },
    { pid: 654302911202, shortName: '除湿袋', pname: '徐磊', shop: '天美严选精选', group: '一组', shell_money: 53120, sd_money: 2000, wb_money: 5400 },
    { pid: 587602339103, shortName: '防爆热水袋', pname: '王小伟', shop: '天美严选精选', group: '一组', shell_money: 38400, sd_money: 1400, wb_money: 4300 },
    { pid: 612204389105, shortName: '抽真空压缩袋', pname: '陈美丽', shop: '极客居家专营', group: '二组', shell_money: 27900, sd_money: 1100, wb_money: 3105 },
    { pid: 694302919314, shortName: '无痕衣架', pname: '李思思', shop: '极客居家专营', group: '三组', shell_money: 26500, sd_money: 800, wb_money: 2100 },
  ];

  const activeQct = useFakeData ? mockQctRecords : qctRecords;
  const activePdd = useFakeData ? mockPddRecords : pddRecords;

  // Spends
  const totalSpend = activeQct.reduce((sum, r) => sum + r.spend, 0);
  // Real sales
  const totalSales = activePdd.reduce((sum, r) => sum + r.shell_money, 0);
  // Combined ROI = Sales / Cost
  const combinedROI = totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '—';
  
  // Marketers ROI matching
  const marketerSpends: { [name: string]: number } = {};
  const marketerSales: { [name: string]: number } = {};

  activeQct.forEach(r => {
    if (r.marketerName) {
      marketerSpends[r.marketerName] = (marketerSpends[r.marketerName] || 0) + r.spend;
    }
  });

  activePdd.forEach(p => {
    if (p.pname) {
      marketerSales[p.pname] = (marketerSales[p.pname] || 0) + p.shell_money;
    }
  });

  const marketers = Array.from(new Set([
    ...Object.keys(marketerSpends),
    ...Object.keys(marketerSales)
  ]));

  const chartData = marketers.map(name => {
    const spend = marketerSpends[name] || 0;
    const sales = marketerSales[name] || 0;
    const roi = spend > 0 ? parseFloat((sales / spend).toFixed(2)) : 0;
    return {
      name,
      '推广费用 (QCT)': parseFloat(spend.toFixed(2)),
      '实体销售 (PDD)': parseFloat(sales.toFixed(2)),
      '投入产出比 (ROI)': roi
    };
  }).sort((a, b) => b['实体销售 (PDD)'] - a['实体销售 (PDD)']);

  // Match colors for charting
  const COLORS = ['#38bdf8', '#F472B6', '#a78bfa', '#e2e8f0', '#94a3b8', '#64748b'];

  // Calculate shops sales
  const shopSales: { [shop: string]: number } = {};
  activePdd.forEach(p => {
    if (p.shop) {
      shopSales[p.shop] = (shopSales[p.shop] || 0) + p.shell_money;
    }
  });
  const shopChartData = Object.entries(shopSales).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2))
  })).sort((a, b) => b.value - a.value);

  // Top perform ranking
  const topMarketer = chartData[0];

  return (
    <div className="space-y-6">
      {/* Simulation Toggle header bar */}
      <div className="bg-[#111111] border border-white/10 p-5 rounded-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-[#38bdf8] animate-pulse shrink-0" />
          <div className="text-left font-sans">
            <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-[0.2em] block mb-0.5">System Status / 系统状态</span>
            <span className="text-xs text-white/60">
              {useFakeData 
                ? '演示数据运行中：展示电商仿真组数据，载入真实 QCT/PDD 报表后自动更新为系统实测大盘。' 
                : '生产环境大盘：当前展示企业实测结算流水和ROI转换明细。'
              }
            </span>
          </div>
        </div>

        {qctRecords.length === 0 && pddRecords.length === 0 && (
          <button
            onClick={() => setUseFakeData(!useFakeData)}
            className="cursor-pointer bg-white/5 hover:bg-white hover:text-black text-white border border-white/10 px-4 py-2.5 rounded-none text-[10px] uppercase tracking-[0.2em] font-mono transition-colors duration-150 shrink-0"
          >
            <span>{useFakeData ? 'Empty Dashboard' : 'Load Demo Data'}</span>
          </button>
        )}
      </div>

      {/* KPI Core indicators container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none relative overflow-hidden transition-colors hover:bg-white/5 text-left">
          <div className="flex justify-between items-start mb-2">
            <span className="text-white/40 text-[9px] font-bold tracking-[0.25em] uppercase">
              REVENUE / PDD 纯销售额
            </span>
            <span className="p-1 px-1.5 bg-[#38bdf8]/10 text-[#38bdf8] text-[9px] font-mono uppercase tracking-wider">
              PDD Real
            </span>
          </div>
          <p className="text-2xl font-light text-white mt-1.5 tracking-tight font-sans">
            <span className="text-xs text-white/30 mr-1 italic">¥</span>
            {totalSales.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="w-full h-[1px] bg-white/10 mt-4 mb-2">
            <div className="w-[70%] h-full bg-[#38bdf8]"></div>
          </div>
          <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
            Net settled earnings total
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none relative overflow-hidden transition-colors hover:bg-white/5 text-left">
          <div className="flex justify-between items-start mb-2">
            <span className="text-white/40 text-[9px] font-bold tracking-[0.25em] uppercase">
              AD SPEND / 推广费用
            </span>
            <span className="p-1 px-1.5 bg-[#f472b6]/10 text-[#f472b6] text-[9px] font-mono uppercase tracking-wider">
              QCT Click
            </span>
          </div>
          <p className="text-2xl font-light text-white mt-1.5 tracking-tight font-sans">
            <span className="text-xs text-white/30 mr-1 italic">¥</span>
            {totalSpend.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="w-full h-[1px] bg-white/10 mt-4 mb-2">
            <div className="w-[45%] h-full bg-[#f472b6]"></div>
          </div>
          <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
            Ad spend click aggregate
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none relative overflow-hidden transition-colors hover:bg-white/5 text-left">
          <div className="flex justify-between items-start mb-2">
            <span className="text-white/40 text-[9px] font-bold tracking-[0.25em] uppercase">
              RETURN RATE / 综合 ROI
            </span>
            <span className="p-1 px-1.5 bg-amber-500/10 text-amber-500 text-[9px] font-mono uppercase tracking-wider">
              Efficiency
            </span>
          </div>
          <p className="text-2xl font-semibold text-white mt-1.5 tracking-tight font-sans">
            {combinedROI}
          </p>
          <div className="w-full h-[1px] bg-white/10 mt-4 mb-2">
            <div className="w-[85%] h-full bg-amber-500"></div>
          </div>
          <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
            {totalSpend > 0 ? `1.00 COST FOR ${combinedROI} REVENUE` : 'Requires QCT stream'}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none relative overflow-hidden transition-colors hover:bg-white/5 text-left">
          <div className="flex justify-between items-start mb-2">
            <span className="text-white/40 text-[9px] font-bold tracking-[0.25em] uppercase">
              STORES / 活跃店铺数量
            </span>
            <span className="p-1 px-1.5 bg-purple-500/10 text-purple-400 text-[9px] font-mono uppercase tracking-wider">
              Channels
            </span>
          </div>
          <p className="text-2xl font-light text-white mt-1.5 tracking-tight font-sans">
            {shopChartData.length} <span className="text-xs text-white/40 font-mono">STORES IP</span>
          </p>
          <div className="w-full h-[1px] bg-white/10 mt-4 mb-2">
            <div className="w-[60%] h-full bg-purple-500"></div>
          </div>
          <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest">
            Operational shop accounts
          </div>
        </div>
      </div>

      {/* Charts layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart - Marketer Spend vs Sales */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none shadow-sm lg:col-span-2 overflow-hidden flex flex-col text-left">
          <div className="mb-4">
            <div className="text-[#38bdf8] text-[9px] font-bold tracking-[0.3em] uppercase mb-1">TEAM REPORT / 团队效能分析</div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>团队成员营销效率：推广成本 vs 真实出单销售</span>
            </h3>
            <p className="text-white/40 text-xs mt-1">
              比对各负责人的直通车推广花费与拼多多商品纯实收销售。
            </p>
          </div>

          <div className="h-[280px] w-full text-xs">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/20 uppercase tracking-widest font-mono">
                No active records to match
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                  <XAxis dataKey="name" stroke="#555555" tick={{ fill: '#888' }} />
                  <YAxis stroke="#555555" tick={{ fill: '#888' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    itemStyle={{ color: '#aaa' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="实体销售 (PDD)" name="PDD 销售额" fill="#38bdf8" radius={0} />
                  <Bar dataKey="推广费用 (QCT)" name="QCT 广告费" fill="#f472b6" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart - Store Share */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none shadow-sm text-left flex flex-col">
          <div className="mb-4">
            <div className="text-purple-400 text-[9px] font-bold tracking-[0.3em] uppercase mb-1">STORES PROPORTIONS / 所属网店占有率</div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>店铺营收市场份额</span>
            </h3>
            <p className="text-white/40 text-xs mt-1">
              各店铺产生的销售额对团队总体贡献的百分比率。
            </p>
          </div>

          <div className="h-[180px] w-full flex items-center justify-center relative text-xs">
            {shopChartData.length === 0 ? (
              <div className="text-white/20 uppercase font-mono tracking-widest">No active metadata</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shopChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {shopChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0px' }}
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '销售额']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Total Label matching design */}
            <div className="absolute flex flex-col items-center justify-center select-none font-sans">
              <span className="text-[8px] text-white/40 uppercase tracking-[0.2em]">合计营收</span>
              <span className="text-xs font-bold text-white mt-0.5 font-mono">
                ¥{Math.round(totalSales).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Legend Labels */}
          <div className="mt-2 space-y-2 max-h-[110px] overflow-y-auto tracking-wide text-xs">
            {shopChartData.map((item, idx) => {
              const percent = totalSales > 0 ? ((item.value / totalSales) * 100).toFixed(1) : '0';
              return (
                <div key={idx} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-white/60 truncate font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-white/40">¥{item.value.toLocaleString()}</span>
                    <span className="text-[#38bdf8] font-bold">({percent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team rankings & Campaign insight cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        {/* Left widget: Highest Marketer ranking */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none shadow-sm space-y-4">
          <div className="text-amber-500 text-[9px] font-bold tracking-[0.3em] uppercase mb-1">AWARDS / 荣誉榜</div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2 mt-0">
            <Award className="w-4.5 h-4.5 text-[#38bdf8]" />
            <span>负责人实销王</span>
          </h3>

          {topMarketer ? (
            <div className="space-y-4">
              <div className="bg-black/40 border border-white/10 p-4 rounded-none flex items-center gap-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-[#38bdf8]/5 rounded-full filter blur-xl select-none" />
                <div className="w-12 h-12 bg-white/5 border border-white/15 text-[#38bdf8] rounded-full flex items-center justify-center font-extrabold text-base select-none shrink-0 shadow-sm font-mono">
                  01
                </div>
                <div>
                  <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">TOP RECORD OFFICER</p>
                  <p className="text-base font-bold text-white mt-0.5">{topMarketer.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-black/20 p-3 border border-white/5">
                  <span className="text-white/30 text-[9px] uppercase tracking-widest block">Settled Gross</span>
                  <p className="text-white font-semibold text-xs mt-1">¥{topMarketer['实体销售 (PDD)'].toLocaleString()}</p>
                </div>
                <div className="bg-black/20 p-3 border border-white/5">
                  <span className="text-white/30 text-[9px] uppercase tracking-widest block">ROI Rate</span>
                  <p className="text-[#38bdf8] font-semibold text-xs mt-1">
                    {topMarketer['投入产出比 (ROI)'] > 0 ? `${topMarketer['投入产出比 (ROI)']}x` : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-white/20 text-xs py-8 text-center uppercase tracking-wider font-mono">Waiting for payload</p>
          )}
        </div>

        {/* Right widget: Complete marketing checklist instructions */}
        <div className="bg-[#111111] border border-white/10 p-6 rounded-none shadow-sm lg:col-span-2 space-y-4 flex flex-col justify-between">
          <div>
            <div className="text-[#f472b6] text-[9px] font-bold tracking-[0.3em] uppercase mb-1">PROTOCOLS / 运行指南</div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mt-0">
              <Library className="w-4.5 h-4.5 text-[#f472b6]" />
              <span>智能财务分摊核查操作规程</span>
            </h3>
            <p className="text-white/50 text-xs mt-2 pr-4 leading-relaxed font-sans">
              本工具致力于提供精细、透明的团队直通车推广成本分摊核算法。您可以通过 
              <strong className="text-white">【映射管理器】</strong> 来导入/查改产品唯一数字 ID ↔ 所属商铺 ↔ 短俗名 ↔ 服务负责人的全局关联大字典。
              接着部署直通车与拼多多销量两张源表进行一键解构、筛选、去噪及加权，系统便会自动依循预设算法，提供具有高可信度的业绩及 ROI 输出，并对齐标准格式财务表。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-white/40 select-none pt-2 font-mono uppercase tracking-widest border-t border-white/5">
            <span className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-[#38bdf8]" /> ID precision index alignment</span>
            <span className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-[#38bdf8]" /> Dynamic refund filter</span>
            <span className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-[#38bdf8]" /> Fuzzy comment classification</span>
            <span className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-[#38bdf8]" /> Multi-split ledger generator</span>
          </div>
        </div>
      </div>
    </div>
  );
}
