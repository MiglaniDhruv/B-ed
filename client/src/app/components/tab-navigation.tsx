import { ReactNode, useState, useRef, useEffect } from "react";
import { LucideIcon, Menu, X } from "lucide-react";

interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
}: TabNavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileOpen]);

  const activeTabItem = tabs.find((t) => t.id === activeTab);
  const ActiveIcon = activeTabItem?.icon;

  const handleTabClick = (id: string) => {
    onTabChange(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ── Desktop: horizontal scrollable tab bar ── */}
      <div className="hidden md:flex items-center overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Mobile: dropdown button ── */}
      <div className="flex md:hidden items-center relative" ref={menuRef}>
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          {ActiveIcon && <ActiveIcon className="w-4 h-4 text-slate-600" />}
          <span className="max-w-[120px] truncate">
            {activeTabItem?.label ?? "Menu"}
          </span>
          {/* Show total badge count on mobile trigger */}
          {tabs.reduce((sum, t) => sum + (t.badge ?? 0), 0) > 0 && (
            <span className="bg-red-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {tabs.reduce((sum, t) => sum + (t.badge ?? 0), 0)}
            </span>
          )}
          {mobileOpen ? (
            <X className="w-4 h-4 ml-1 text-slate-500" />
          ) : (
            <Menu className="w-4 h-4 ml-1 text-slate-500" />
          )}
        </button>

        {/* Dropdown panel */}
        {mobileOpen && (
          <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  <span className="flex-1">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? "bg-white text-slate-900"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
