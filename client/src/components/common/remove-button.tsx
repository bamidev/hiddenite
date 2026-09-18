export default function RemoveButton({ onClick }: { onClick: () => void }) {
  return <>
    <button className="remove-button" onClick={onClick}>&times;</button>
  </>
}
