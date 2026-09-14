export default function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="close-button" onClick={onClick}>
      &times;
    </button>
  )
}
