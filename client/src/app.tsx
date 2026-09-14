import { useState } from 'react'
import Api from './api.ts'
import MainBar from './components/main-bar.tsx'
import './app.css'
import AddButton from './components/common/add-button.tsx'


const api = new Api('http://localhost:3000')


function App() {
  const [sources, setSources] = useState([]);

  function addSource() {
    setSources(s => [...s, { id: crypto.randomUUID() }])
  }

  async function onAddMixSource() {
    await api.put('mix-source')
    addSource()
  }

  return (
    <>
      <section id="center">
        <div className='main-bar'><MainBar /></div>
        <div id="mix">
          <div className='mix-bar'>
            <AddButton onClick={onAddMixSource} />
          </div>
          {sources.map(i => (
            <MixSource name={i} />
          ))}
        </div>
      </section>
    </>
  )
}

function MixActionsButton() {
  return 
}

export default App
