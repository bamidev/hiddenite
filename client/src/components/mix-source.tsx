import CloseButton from './common/close-button.tsx'

export interface MixSourceData {
  id: string
  name: string
}

export default function MixSource({ source, onClose }: { source: MixSourceData, onClose: () => void }) {
  return (
    <div className="mix-source">
      <CloseButton onClick={onClose} />
      {source.name}
    </div>
  )
}
