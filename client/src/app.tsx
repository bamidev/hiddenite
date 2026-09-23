/**
 * The root application component: lays out the nav bar, main bar, the list of mix sources
 * (playback state machines with their queues), and the collapsible library section, and owns
 * the top-level state (loaded mix sources, library folders, and which queue is "active" for
 * queuing new songs) shared across those areas.
 */

import { useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import MainBar from './components/main-bar.tsx'
import NavBar from './components/nav-bar.tsx'
import './app.css'
import MixSource, { type MixSourceData } from './components/mix-source.tsx'
import { type QueueData } from './components/queue.tsx'
import ConsolidatedLibrary, { type LibraryFolder } from './components/consolidated-library.tsx'
import CollapsibleSection from './components/common/collapsible-section.tsx'


/**
 * Root component of the app. Loads the list of mix sources and library folders on mount,
 * tracks which queue is currently "active" (the target for songs added from the library),
 * and renders the nav bar, main bar, mix sources, and the library accordion section.
 */
function App() {
  const [sources, setSources] = useState<MixSourceData[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const activeQueueIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadSources() {
      const response = await api.get('mix-source')
      const loadedSources: MixSourceData[] = await response.json()
      setSources(loadedSources)

      // Set the current active queue to the first queue found, if no active queue is there yet
      if (activeQueueIdRef.current == null) {
        const firstQueue = loadedSources.flatMap(source => source.queues ?? [])[0]
        if (firstQueue) activeQueueIdRef.current = firstQueue.id
      }
    }
    loadSources()

    api.get('library/folder').then(response => response.json()).then(setLibraryFolders)
  }, [])

  /**
   * Creates a new mix source on the server and appends it to local state.
   */
  async function onAddMixSource() {
    const response = await api.put('mix-source')
    const source: MixSourceData = await response.json()
    setSources(s => [...s, source])
  }

  /**
   * Creates a new queue on the given mix source and appends it to that source's queue list.
   * If no queue is currently active, the new queue becomes the active one.
   *
   * @param mixSourceId - The id of the mix source to add the queue to.
   */
  async function onAddQueue(mixSourceId: string) {
    const response = await api.put(`mix-source/${mixSourceId}/queue`)
    const queue: QueueData = await response.json()
    setSources(s => s.map(source =>
      source.id === mixSourceId
        ? { ...source, queues: [...(source.queues ?? []), queue] }
        : source
    ))

    // Set the current active queue to the new queue, if no active queue is there yet
    if (activeQueueIdRef.current == null)
      activeQueueIdRef.current = queue.id
  }

  /**
   * Renames a mix source on the server and updates local state to match.
   *
   * @param mixSourceId - The id of the mix source to rename.
   * @param name - The new name for the mix source.
   */
  async function onRenameMixSource(mixSourceId: string, name: string) {
    await api.put(`mix-source/${mixSourceId}/name`, { name })
    setSources(s => s.map(source =>
      source.id === mixSourceId ? { ...source, name } : source
    ))
  }

  /**
   * Renames a queue on the server and updates local state to match.
   *
   * @param mixSourceId - The id of the mix source that owns the queue.
   * @param queueId - The id of the queue to rename.
   * @param name - The new name for the queue.
   */
  async function onRenameQueue(mixSourceId: string, queueId: string, name: string) {
    await api.put(`queue/${queueId}/name`, { name })
    setSources(s => s.map(source =>
      source.id === mixSourceId
        ? { ...source, queues: (source.queues ?? []).map(queue => queue.id === queueId ? { ...queue, name } : queue) }
        : source
    ))
  }

  return (
    <>
      <NavBar />
      <section id="center">
        <div className='main-bar'><MainBar /></div>
        <div id="mix">
          {sources.map(source => (
            <MixSource
              key={source.id}
              source={source}
              folders={libraryFolders}
              onClose={() => setSources(s => s.filter(x => x.id !== source.id))}
              onRename={name => onRenameMixSource(source.id, name)}
              onAddQueue={() => onAddQueue(source.id)}
              onRenameQueue={(queueId, name) => onRenameQueue(source.id, queueId, name)}
              onActivateQueue={queueId => { activeQueueIdRef.current = queueId }}
            />
          ))}
          <button type="button" className="btn btn-primary w-100" onClick={onAddMixSource}>
            Add mix source
          </button>
        </div>
        <div className="accordion" id="library-accordion">
          <CollapsibleSection id="library-section" title="Library">
            <ConsolidatedLibrary activeQueueIdRef={activeQueueIdRef} />
          </CollapsibleSection>
        </div>
      </section>
    </>
  )
}

export default App
