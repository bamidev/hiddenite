export default function NavBar() {
  return (
    <nav className="navbar navbar-expand bg-body-tertiary">
      <div className="container-fluid">
        <span className="navbar-brand mb-0 h1">Party Player</span>
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
                  <a className="dropdown-item" href="#">Rescan</a>
                </li>
              </ul>
            </li>
          </ul>
        )}
      </div>
    </nav>
  )
}
