// src/App.jsx
import SVGEditor from './components/SVGEditor'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">SVG Editor</h1>
        <SVGEditor />
      </div>
    </div>
  )
}

export default App