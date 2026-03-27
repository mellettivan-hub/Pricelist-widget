import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Vendors from "./pages/Vendors";
import PriceLists from "./pages/PriceLists";
import PriceHistory from "./pages/PriceHistory";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route path="upload" element={<Upload />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="price-lists" element={<PriceLists />} />
            <Route path="history" element={<PriceHistory />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
