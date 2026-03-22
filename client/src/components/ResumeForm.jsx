import { useState } from 'react'
import axios from 'axios'

export default function ResumeForm() {
  const [resumeText, setResumeText] = useState('')
  const [skills, setSkills] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    if (!resumeText.trim()) {
      setError('Please paste your resume text first.')
      return
    }

    setLoading(true)
    setError('')
    setSkills([])
    setRoles([])

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/analyze`, {
        resumeText
      })
      setSkills(res.data.skills)
      setRoles(res.data.suggestedRoles)
    } catch (err) {
      setError('Analysis failed. Make sure the server is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <textarea
        className="resume-input"
        rows={12}
        placeholder="Paste your resume text here...&#10;&#10;Example:&#10;Experienced developer skilled in Python, TensorFlow, SQL and AWS..."
        value={resumeText}
        onChange={e => setResumeText(e.target.value)}
      />

      <button
        className="analyze-btn"
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? '⏳ Analyzing...' : '🔍 Analyze Resume'}
      </button>

      {error && <p className="error">{error}</p>}

      {skills.length > 0 && (
        <div className="results">
          <div className="result-box">
            <h2>✅ Detected Skills</h2>
            <ul>
              {skills.map((skill, i) => (
                <li key={i}>✔ {skill}</li>
              ))}
            </ul>
          </div>

          <div className="result-box">
            <h2>💼 Suggested Roles</h2>
            <ul>
              {roles.map((role, i) => (
                <li key={i}>✔ {role}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
