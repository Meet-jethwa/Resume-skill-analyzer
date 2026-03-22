import './App.css'
import ResumeForm from './components/ResumeForm'

function App() {
  return (
    <div className="app">
      <header>
        <h1>☁️ Cloud Resume Skill Analyzer</h1>
        <p>Paste your resume text and let AI extract your skills</p>
      </header>
      <main>
        <ResumeForm />
      </main>
    </div>
  )
}

export default App
