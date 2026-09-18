import { APP_NAME_CAPITALIZED } from 'hiddenite'

export default function NavBar() {
  return (
    <nav className="navbar navbar-expand bg-body-tertiary">
      <div className="container-fluid">
        <span className="navbar-brand mb-0 h1">{APP_NAME_CAPITALIZED}</span>
        {window.electron?.isElectron && (
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
                <li>
                  <a className="dropdown-item" href="#" onClick={() => window.electron?.rescanLibrary()}>Rescan</a>
                </li>
              </ul>
            </li>
          </ul>
        )}
      </div>
    </nav>
  )
}
