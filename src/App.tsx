import React, { useState, useEffect } from 'react';
import { ProductMapping, QctRecord, PddProcessedProduct, IndividualSummary } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import QctExtractor from './components/QctExtractor';
import PddProcessor from './components/PddProcessor';
import MappingManager from './components/MappingManager';
import { 
  Building2, Users, FileSpreadsheet, Percent, LogOut, 
  Settings, KeyRound, CheckSquare, BarChart3, TrendingUp, Landmark, Menu, X 
} from 'lucide-react';

const INITIAL_MAPPINGS: ProductMapping[] = [
  { productId: '665302919313', shop: '御尚品生活馆', shortName: '骨痛贴膏', marketerName: '王小伟' },
  { productId: '662094389101', shop: '御尚品生活馆', shortName: '蒸汽眼罩', marketerName: '陈美丽' },
  { productId: '654302911202', shop: '天美严选精选', shortName: '除湿袋', marketerName: '徐磊' },
  { productId: '587602339103', shop: '天美严选精选', shortName: '防爆热水袋', marketerName: '王小伟' },
  { productId: '694302919314', shop: '极客居家专营', shortName: '无痕衣架', marketerName: '李思思' },
  { productId: '612204389105', shop: '极客居家专营', shortName: '抽真空压缩袋', marketerName: '陈美丽' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'qct' | 'pdd' | 'mapping'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global shared registries and calculation results
  const [mappings, setMappings] = useState<ProductMapping[]>(INITIAL_MAPPINGS);
  const [qctRecords, setQctRecords] = useState<QctRecord[]>([]);
  const [pddRecords, setPddRecords] = useState<PddProcessedProduct[]>([]);
  const [pddSummaries, setPddSummaries] = useState<IndividualSummary[]>([]);

  useEffect(() => {
    // Session token check
    const authStatus = localStorage.getItem('_authenticated_token');
    if (authStatus === 'TRUE') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    if (confirm('是否要登出当前系统作业身份？')) {
      localStorage.removeItem('_authenticated_token');
      localStorage.removeItem('_authenticated_time');
      setIsAuthenticated(false);
    }
  };

  const handleMappingsImported = (imported: ProductMapping[]) => {
    setMappings(prev => {
      const mergedMap = [...prev];
      imported.forEach(imp => {
        const idx = mergedMap.findIndex(m => m.productId === imp.productId);
        if (idx !== -1) {
          // override / update existing link
          mergedMap[idx] = imp;
        } else {
          mergedMap.push(imp);
        }
      });
      return mergedMap;
    });
  };

  const menuItems = [
    { id: 'dashboard', label: '工作台大盘', icon: BarChart3 },
    { id: 'qct', label: '直通车数据提取', icon: TrendingUp },
    { id: 'pdd', label: 'PDD 销量统计', icon: FileSpreadsheet },
    { id: 'mapping', label: '商品对照字典', icon: Landmark },
  ] as const;

  if (!isAuthenticated) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header */}
      <div className="md:hidden bg-[#111111] border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-[#38bdf8]/45 flex items-center justify-center font-bold text-[#38bdf8] text-xs">
            AOS
          </div>
          <span className="font-bold text-xs tracking-[0.25em] uppercase text-white">AETHER OS STATS</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 px-2 border border-white/10 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Left Sidebar (for Desktop) and sliding drawer (for Mobile) */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-[#111111] border-r border-white/10 flex flex-col justify-between 
        transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen shrink-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          {/* Logo brand label */}
          <div className="p-6 border-b border-white/10 flex items-center gap-3 bg-black/40">
            <div className="relative w-10 h-10 rounded-full border border-[#38bdf8]/40 flex items-center justify-center text-xs font-mono font-bold text-[#38bdf8] shrink-0">
              <span className="absolute inset-0 rounded-full border border-white/5 animate-pulse"></span>
              AOS
            </div>
            <div className="text-left">
              <h1 className="font-bold text-xs uppercase tracking-[0.15em] text-white">智能核对中心</h1>
              <span className="text-[9px] text-white/40 uppercase font-mono tracking-widest block mt-0.5">Atmosphere v4.0</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2 text-left">
            <span className="px-3.5 text-[9px] font-semibold text-white/30 uppercase tracking-[0.3em] block mb-3 select-none">
              Protocols / 核心模块
            </span>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    w-full cursor-pointer flex items-center gap-3 px-4 py-3 rounded-none text-xs tracking-[0.1em] transition-colors duration-150 border-r-2 text-left font-medium
                    ${isActive 
                      ? 'bg-white/5 text-white border-[#38bdf8]' 
                      : 'text-white/40 hover:text-white hover:bg-white/5 border-transparent'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#38bdf8]' : 'text-white/30'}`} />
                  <span className="uppercase text-[11px] font-medium tracking-wider">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Account / Footer status block */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-black/20">
          <div className="flex items-center gap-2.5 p-3 bg-white/5 border border-white/10 rounded-none">
            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white text-[10px] font-bold font-mono">
              JD
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-[11px] text-white font-medium uppercase tracking-wider truncate">wyh763663139</p>
              <span className="text-[9px] text-white/30 font-mono truncate block mt-0.5">system: operational</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="cursor-pointer w-full bg-white/5 hover:bg-white hover:text-black border border-white/10 text-white py-2 px-3 rounded-none text-[9px] uppercase tracking-[0.3em] font-mono transition-colors duration-150 flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Terminate / 登出</span>
          </button>
        </div>
      </aside>

      {/* Dimmed cover background for mobile drawer and click closing */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-20 md:hidden"
        />
      )}

      {/* Main layout frame */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto max-h-screen">
          
          {/* Page body */}
          {currentTab === 'dashboard' && (
            <Dashboard 
              mappings={mappings} 
              qctRecords={qctRecords}
              pddRecords={pddRecords}
              pddSummaries={pddSummaries}
            />
          )}

          {currentTab === 'qct' && (
            <QctExtractor 
              mappings={mappings}
              onQctDataUpdated={(recs) => setQctRecords(recs)}
            />
          )}

          {currentTab === 'pdd' && (
            <PddProcessor 
              globalMappings={mappings}
              onMappingsImported={handleMappingsImported}
              onPddDataUpdated={(recs, sums) => {
                setPddRecords(recs);
                setPddSummaries(sums);
              }}
            />
          )}

          {currentTab === 'mapping' && (
            <MappingManager 
              mappings={mappings}
              setMappings={(m) => setMappings(m)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
