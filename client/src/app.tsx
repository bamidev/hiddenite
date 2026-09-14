import { useEffect, useState } from 'react'
import Api from './api.ts'
import MainBar from './components/main-bar.tsx'
import './app.css'
import AddButton from './components/common/add-button.tsx'
import MixSource, { type MixSourceData } from './components/mix-source.tsx'


const api = new Api('http://localhost:3000')


function App() {
  const [sources, setSources] = useState<MixSourceData[]>([]);

  useEffect(() => {
    async function loadSources() {
      const response = await api.get('mix-source')
      setSources(await response.json())
    }
    loadSources()
  }, [])

  async function onAddMixSource() {
    const response = await api.put('mix-source')
    const source: MixSourceData = await response.json()
    setSources(s => [...s, source])
  }

  return (
    <>
      <section id="center">
        <div className='main-bar'><MainBar /></div>
        <div id="mix">
          <div className='mix-bar'>
            <AddButton onClick={onAddMixSource} />
          </div>
          {sources.map(source => (
            <MixSource
              key={source.id}
              source={source}
              onClose={() => setSources(s => s.filter(x => x.id !== source.id))}
            />
          ))}
        </div>
      </section>
    </>
  )
}

export default App
