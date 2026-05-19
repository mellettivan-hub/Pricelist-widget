import { NavLink, Outlet } from "react-router-dom";
import { 
  UploadSimple, 
  Storefront, 
  Files, 
  House,
  Package,
  ArrowsLeftRight
} from "@phosphor-icons/react";

const Layout = () => {
  const navItems = [
    { to: "/", icon: House, label: "Dashboard", exact: true },
    { to: "/inventory", icon: Package, label: "Zoho Inventory" },
    { to: "/upload", icon: UploadSimple, label: "Upload Pricelist" },
    { to: "/match", icon: ArrowsLeftRight, label: "Match & Update" },
    { to: "/vendors", icon: Storefront, label: "Vendors" },
    { to: "/price-lists", icon: Files, label: "Price Lists" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar" data-testid="sidebar">
        <div className="p-6 border-b border-zinc-200">
          <h1 className="font-heading text-xl font-black text-[#002FA7] tracking-tight">
            PRICE CHECK
          </h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">
            Zoho Inventory
          </p>
        </div>
        
        <nav className="py-4">
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
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-200 bg-white">
          <p className="text-xs text-zinc-400 text-center">
            v2.0 | Zoho Connected
          </p>
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
