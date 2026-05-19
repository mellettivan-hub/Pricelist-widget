import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import ZohoDashboard from "./pages/ZohoDashboard";
import ZohoInventory from "./pages/ZohoInventory";
import Upload from "./pages/Upload";
import Vendors from "./pages/Vendors";
import PriceLists from "./pages/PriceLists";
import MatchAndUpdate from "./pages/MatchAndUpdate";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ZohoDashboard />} />
            <Route path="inventory" element={<ZohoInventory />} />
            <Route path="upload" element={<Upload />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="price-lists" element={<PriceLists />} />
            <Route path="match" element={<MatchAndUpdate />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
