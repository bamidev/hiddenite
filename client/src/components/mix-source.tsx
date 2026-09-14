export interface MixSourceData {
  id: string
  name: string
}

export default function MixSource({ source }: { source: MixSourceData }) {
  return (
    <div className="mix-source">
      {source.name}
    </div>
  )
}
