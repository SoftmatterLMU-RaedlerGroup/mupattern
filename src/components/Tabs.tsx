interface TabsProps {
  activeTab: 'create' | 'register'
  onTabChange: (tab: 'create' | 'register') => void
}

export function Tabs({ activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
      <button
        onClick={() => onTabChange('create')}
        className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
          activeTab === 'create'
            ? 'bg-blue-600 text-white'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
        }`}
      >
        Create
      </button>
      <button
        onClick={() => onTabChange('register')}
        className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
          activeTab === 'register'
            ? 'bg-blue-600 text-white'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
        }`}
      >
        Register
      </button>
    </div>
  )
}
