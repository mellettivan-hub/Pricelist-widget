import "@/App.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ZohoDashboard from "./pages/ZohoDashboard";
import ZohoInventory from "./pages/ZohoInventory";
import Upload from "./pages/Upload";
import Vendors from "./pages/Vendors";
import PriceLists from "./pages/PriceLists";
import MatchAndUpdate from "./pages/MatchAndUpdate";
import ActivityLogs from "./pages/ActivityLogs";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('pricecheck_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData.username);
      } catch (e) {
        localStorage.removeItem('pricecheck_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (username) => {
    setUser(username);
  };

  const handleLogout = async () => {
    const API_URL = process.env.REACT_APP_BACKEND_URL;
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user })
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('pricecheck_user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
            <Route index element={<ZohoDashboard />} />
            <Route path="inventory" element={<ZohoInventory user={user} />} />
            <Route path="upload" element={<Upload user={user} />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="price-lists" element={<PriceLists />} />
            <Route path="match" element={<MatchAndUpdate user={user} />} />
            <Route path="logs" element={<ActivityLogs />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
