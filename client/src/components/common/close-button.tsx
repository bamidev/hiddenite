/**
 * A small "x" button used to close or dismiss something (e.g. a mix source).
 */

/**
 * Renders a "x" close button.
 *
 * @param onClick - Called when the button is clicked.
 */
export default function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="close-button" onClick={onClick}>
      &times;
    </button>
  )
}
