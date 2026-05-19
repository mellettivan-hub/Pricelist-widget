import { NavLink, Outlet } from "react-router-dom";
import { 
  UploadSimple, 
  Storefront, 
  Files, 
  House,
  Package,
  ArrowsLeftRight,
  ClockCounterClockwise,
  SignOut
} from "@phosphor-icons/react";

const Layout = ({ user, onLogout }) => {
  const navItems = [
    { to: "/", icon: House, label: "Dashboard", exact: true },
    { to: "/inventory", icon: Package, label: "Zoho Inventory" },
    { to: "/upload", icon: UploadSimple, label: "Upload Pricelist" },
    { to: "/match", icon: ArrowsLeftRight, label: "Match & Update" },
    { to: "/vendors", icon: Storefront, label: "Vendors" },
    { to: "/price-lists", icon: Files, label: "Price Lists" },
    { to: "/logs", icon: ClockCounterClockwise, label: "Activity Logs" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar" data-testid="sidebar">
        <div className="p-4 border-b border-zinc-200">
          <img 
            src="/images/forbtech-logo.jpeg" 
            alt="Forbtech" 
            className="h-12 mx-auto rounded-lg shadow"
          />
          <h1 className="font-heading text-lg font-black text-[#002FA7] tracking-tight text-center mt-2">
            PRICE CHECK
          </h1>
        </div>
        
        <nav className="py-4 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon size={20} weight="regular" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        {/* User Info & Logout */}
        <div className="p-4 border-t border-zinc-200 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
              {user?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user}</p>
              <p className="text-xs text-gray-500">Logged in</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <SignOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
