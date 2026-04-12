import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { VaultTab } from '@/components/tabs/VaultTab'
import { ResumenTab } from '@/components/tabs/ResumenTab'
import { ExplorerTab } from '@/components/tabs/ExplorerTab'
import { AutomacionesTab } from '@/components/tabs/AutomacionesTab'
import { ZonasTab } from '@/components/tabs/ZonasTab'
import { AgenteTab } from '@/components/tabs/AgenteTab'
import { HaApiTab } from '@/components/tabs/HaApiTab'

type Tab = 'vault' | 'resumen' | 'explorer' | 'automatizaciones' | 'zonas' | 'agente' | 'haapi'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('vault')

  return (
    <AppShell activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'vault' && <VaultTab />}
      {activeTab === 'resumen' && <ResumenTab />}
      {activeTab === 'explorer' && <ExplorerTab />}
      {activeTab === 'automatizaciones' && <AutomacionesTab />}
      {activeTab === 'zonas' && <ZonasTab />}
      {activeTab === 'agente' && <AgenteTab />}
      {activeTab === 'haapi' && <HaApiTab />}
    </AppShell>
  )
}
