import { useState } from 'react';
import WalletConnect from './components/WalletConnect';
import Dashboard from './components/Dashboard';
import DepositWithdraw from './components/DepositWithdraw';
import BorrowRepay from './components/BorrowRepay';
import SwapTokens from './components/SwapTokens';
import AdminPanel from './components/AdminPanel';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      <header className="p-4 border-b border-gray-800">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-400">DeFi Lending Protocol</h1>
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto py-8">
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-800 pb-4">
          <button
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-indigo-600 shadow-lg' : 'bg-gray-800 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${activeTab === 'deposit' ? 'bg-indigo-600 shadow-lg' : 'bg-gray-800 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('deposit')}
          >
            Deposit/Withdraw
          </button>
          <button
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${activeTab === 'borrow' ? 'bg-indigo-600 shadow-lg' : 'bg-gray-800 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('borrow')}
          >
            Borrow/Repay
          </button>
          <button
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${activeTab === 'swap' ? 'bg-indigo-600 shadow-lg' : 'bg-gray-800 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('swap')}
          >
            Swap Tokens
          </button>
          <button
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${activeTab === 'admin' ? 'bg-indigo-600 shadow-lg' : 'bg-gray-800 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Panel
          </button>
        </div>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'deposit' && <DepositWithdraw />}
        {activeTab === 'borrow' && <BorrowRepay />}
        {activeTab === 'swap' && <SwapTokens />}
        {activeTab === 'admin' && <AdminPanel />}
      </main>
    </div>
  );
}

export default App;