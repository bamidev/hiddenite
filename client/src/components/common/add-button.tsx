/**
 * A small "+" button used throughout the app to trigger adding an item (a queue, a song, etc.).
 */

/**
 * Renders a "+" button.
 *
 * @param onClick - Called when the button is clicked.
 */
export default function AddButton({ onClick }: { onClick: () => void }) {
  return <>
    <button className="add-button" onClick={onClick}>+</button>
  </>
}
