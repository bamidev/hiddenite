import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { api } from '../api.ts'
import RemoteLibrary from './remote-library.tsx'

export interface LibraryFolder {
  name: string
  path: string
}

export default function Libraries({ activeQueueIdRef }: { activeQueueIdRef: RefObject<string | null> }) {
  const [folders, setFolders] = useState<LibraryFolder[]>([])

  useEffect(() => {
    api.get('library/folder').then(response => response.json()).then(setFolders)
  }, [])

  return (
    <div>
      <ul className="nav nav-tabs" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className="nav-link active"
            id="library-tab-all"
            data-bs-toggle="tab"
            data-bs-target="#library-pane-all"
            type="button"
            role="tab"
            aria-controls="library-pane-all"
            aria-selected="true"
          >
            All
          </button>
        </li>
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
        <div className="tab-pane fade show active" id="library-pane-all" role="tabpanel" aria-labelledby="library-tab-all">
          <RemoteLibrary activeQueueIdRef={activeQueueIdRef} />
        </div>
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
