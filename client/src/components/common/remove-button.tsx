/**
 * A small "x" button used to remove an item (e.g. a song from a library or queue).
 */

/**
 * Renders a "x" remove button.
 *
 * @param onClick - Called when the button is clicked.
 */
export default function RemoveButton({ onClick }: { onClick: () => void }) {
  return <>
    <button className="remove-button" onClick={onClick}>&times;</button>
  </>
}
