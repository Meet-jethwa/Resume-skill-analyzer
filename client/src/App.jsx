import { useState } from 'react'
import './App.css'
import ResumeForm from './components/ResumeForm'
import History from './components/History'

function App() {
  const [currentPage, setCurrentPage] = useState('analyzer') // 'analyzer' or 'history'

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cloud Resume Skill Analyzer</h1>
        <p>Upload or paste resume content and get skill insights with role recommendations.</p>
        <nav className="main-nav" aria-label="Primary navigation">
          <button 
            className={`nav-btn ${currentPage === 'analyzer' ? 'active' : ''}`}
            onClick={() => setCurrentPage('analyzer')}
          >
            Analyzer
          </button>
          <button 
            className={`nav-btn ${currentPage === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentPage('history')}
          >
            History
          </button>
        </nav>
      </header>
      <main className="app-main">
        {currentPage === 'analyzer' ? (
          <ResumeForm />
        ) : (
          <History onBack={() => setCurrentPage('analyzer')} />
        )}
      </main>
    </div>
  )
}

export default App
