export default function AddButton({ onClick }: { onClick: () => void }) {
  return <>
    <button className="add-button" onClick={onClick}>+</button>
  </>
}
