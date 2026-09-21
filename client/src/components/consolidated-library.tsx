import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../api.ts'
import RemoteLibrary from './remote-library.tsx'
import LocalLibrary from './local-library.tsx'

export interface LibraryFolder {
  name: string
  path: string
}

export default function ConsolidatedLibrary({ activeQueueIdRef }: { activeQueueIdRef: RefObject<string | null> }) {
  const [folders, setFolders] = useState<LibraryFolder[]>([])

  useEffect(() => {
    api.get('library/folder').then(response => response.json()).then(setFolders)
  }, [])

  return (
    <div>
      <ul className="nav nav-tabs" role="tablist">
        {window.electron?.isElectron && (
          <li className="nav-item" role="presentation">
            <button
              className="nav-link active"
              id="library-tab-local"
              data-bs-toggle="tab"
              data-bs-target="#library-pane-local"
              type="button"
              role="tab"
              aria-controls="library-pane-local"
              aria-selected="true"
            >
              Local
            </button>
          </li>
        )}
        {folders.map(folder => (
          <li className="nav-item" role="presentation" key={folder.name}>
            <button
              className="nav-link"
              id={`library-tab-${folder.name}`}
              data-bs-toggle="tab"
              data-bs-target={`#library-pane-${folder.name}`}
              type="button"
              role="tab"
              aria-controls={`library-pane-${folder.name}`}
              aria-selected="false"
            >
              {folder.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="tab-content">
        {window.electron?.isElectron && (
          <div className="tab-pane fade show active" id="library-pane-local" role="tabpanel" aria-labelledby="library-tab-local">
            <LocalLibrary activeQueueIdRef={activeQueueIdRef} />
          </div>
        )}
        {folders.map(folder => (
          <div
            key={folder.name}
            className="tab-pane fade"
            id={`library-pane-${folder.name}`}
            role="tabpanel"
            aria-labelledby={`library-tab-${folder.name}`}
          >
            <RemoteLibrary activeQueueIdRef={activeQueueIdRef} folder={folder} />
          </div>
        ))}
      </div>
    </div>
  )
}
