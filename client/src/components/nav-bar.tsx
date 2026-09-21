import { APP_NAME_CAPITALIZED } from 'hiddenite'

export default function NavBar() {
  return (
    <nav className="navbar navbar-expand bg-body-tertiary">
      <div className="container-fluid">
        <span className="navbar-brand mb-0 h1">{APP_NAME_CAPITALIZED}</span>
      </div>
    </nav>
  )
}
