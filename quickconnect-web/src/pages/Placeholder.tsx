import { useParams } from 'react-router-dom'

export function Placeholder({ name }: { name: string }) {
  const params = useParams()
  return (
    <div className="py-12 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
      <p className="mt-2 text-gray-600">This page is coming soon.</p>
      {Object.keys(params).length > 0 && (
        <p className="mt-1 text-sm text-gray-500">Params: {JSON.stringify(params)}</p>
      )}
    </div>
  )
}
