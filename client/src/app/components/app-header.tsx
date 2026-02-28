import { ReactNode } from "react";
import logo from "../../assets/logo.png";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  actions,
  children,
}: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title row */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <img src={logo} alt="Logo" className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {/* Tab bar — sits directly below title, flush to bottom border */}
        {children && (
          <div className="flex items-center mb-2 md:mb-0">{children}</div>
        )}
      </div>
    </header>
  );
}
