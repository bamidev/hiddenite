import { APP_NAME_CAPITALIZED } from 'hiddenite'
import { api } from '../api.ts'

async function onRescanRemoteLibrary() {
  await api.post('library/rescan')
  window.dispatchEvent(new CustomEvent('remote-library-rescanned'))
}

export default function NavBar() {
  return (
    <nav className="navbar navbar-expand bg-body-tertiary">
      <div className="container-fluid">
        <span className="navbar-brand mb-0 h1">{APP_NAME_CAPITALIZED}</span>
        <ul className="navbar-nav">
          <li className="nav-item dropdown">
            <a
              className="nav-link dropdown-toggle"
              href="#"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Library
            </a>
            <ul className="dropdown-menu">
              {window.electron?.isElectron && (
                <li>
                  <a className="dropdown-item" href="#" onClick={() => window.electron?.rescanLibrary()}>Rescan</a>
                </li>
              )}
              <li>
                <a className="dropdown-item" href="#" onClick={onRescanRemoteLibrary}>Remote rescan</a>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  )
}
