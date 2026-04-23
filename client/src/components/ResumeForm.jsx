import { useState } from 'react'
import axios from 'axios'

export default function ResumeForm() {
  // Fall back to local backend when VITE_API_URL is not configured.
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'

  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [skills, setSkills] = useState([])
  const [roles, setRoles] = useState([])
  const [resumeScore, setResumeScore] = useState(null)
  const [skillMatch, setSkillMatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const roleCategories = {
    'Frontend': ['Frontend Developer', 'Full Stack Developer', 'UI Developer'],
    'Backend': ['Backend Developer', 'Software Engineer', 'API Developer', 'Full Stack Developer'],
    'Data': ['Data Scientist', 'Data Analyst', 'ML Engineer', 'AI Researcher'],
    'DevOps': ['DevOps Engineer', 'Cloud Engineer', 'Systems Engineer'],
    'Database': ['Database Engineer', 'DBA'],
  }

  // Centralize role filtering so render stays focused on UI markup.
  const getFilteredRoles = () => {
    if (roleFilter === 'all') return roles;
    return roles.filter(role => roleCategories[roleFilter]?.includes(role) || false)
  }

  const handleAnalyze = async () => {
    if (!resumeText.trim() && !pdfFile) {
      setError('Please paste your resume text or upload a PDF.')
      return
    }

    setLoading(true)
    setError('')
    setSkills([])
    setRoles([])
    setResumeScore(null)
    setSkillMatch(null)
    setRoleFilter('all')

    try {
      // Use FormData so the API can handle either plain text or uploaded PDF.
      const formData = new FormData()
      if (pdfFile) {
        formData.append('pdf', pdfFile)
      } else {
        formData.append('resumeText', resumeText)
      }
      if (jobDescription.trim()) {
        formData.append('jobDescription', jobDescription)
      }

      const res = await axios.post(
        `${apiUrl}/api/analyze`,
        formData,
        {
          headers: pdfFile ? { 'Content-Type': 'multipart/form-data' } : {}
        }
      )

      setSkills(res.data.skills)
      setRoles(res.data.suggestedRoles)
      setResumeScore(res.data.resumeScore)
      setSkillMatch(res.data.skillMatch)
    } catch {
      setError('Analysis failed. Make sure the server is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopySkills = async () => {
    try {
      await navigator.clipboard.writeText(skills.join(', '))
      setCopyFeedback('Copied to clipboard.')
    } catch {
      setCopyFeedback('Unable to copy automatically. Please copy manually.')
    }
    setTimeout(() => setCopyFeedback(''), 2000)
  }

  // Reset all inputs and analysis outputs back to initial state.
  const handleClearAll = () => {
    setResumeText('')
    setJobDescription('')
    setPdfFile(null)
    setSkills([])
    setRoles([])
    setResumeScore(null)
    setSkillMatch(null)
    setError('')
    setRoleFilter('all')
  }

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPdfFile(file)
      setResumeText('') // Clear text when PDF is selected
    }
  }

  const filteredRoles = getFilteredRoles()

  return (
    <div className="form-container">
      <div className="input-section">
        <div className="field-group">
          <label className="field-label" htmlFor="resume-input">Resume Content</label>
          <textarea
            id="resume-input"
            className="resume-input"
            rows={10}
            placeholder="Paste your resume text here...&#10;&#10;Example:&#10;Experienced developer skilled in Python, React, AWS, SQL..."
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            disabled={!!pdfFile}
          />
        </div>
        
        <div className="pdf-upload">
          <input
            type="file"
            accept=".pdf"
            onChange={handlePdfChange}
            id="pdf-input"
          />
          <label htmlFor="pdf-input" className="pdf-label">
            {pdfFile ? 'Change PDF' : 'Upload PDF'}
          </label>
          {pdfFile && <p className="file-note">Selected file: {pdfFile.name}</p>}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="job-description-input">Job Description (Optional)</label>
          <textarea
            id="job-description-input"
            className="job-description-input"
            rows={8}
            placeholder="Paste a job description to calculate skill match percentage and missing skills."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="button-group">
        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Resume'}
        </button>
        
        {(resumeText || pdfFile || skills.length > 0) && (
          <button className="clear-btn" onClick={handleClearAll}>
            Clear All
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {skills.length > 0 && (
        <div className="results">
          <div className="result-header">
            <h2>Analysis Results</h2>
            <div className="metric-badges">
              {resumeScore !== null && (
                <div className="badge metric-score-badge">
                  Score: {resumeScore}/10
                </div>
              )}
              <div className="badge metric-skills-badge">
                {skills.length} skill{skills.length !== 1 ? 's' : ''} detected
              </div>
            </div>
          </div>

          <div className="result-box">
            <div className="result-header-small">
              <h3>Detected Skills</h3>
              <button className="copy-btn" onClick={handleCopySkills}>
                Copy
              </button>
            </div>
            {copyFeedback && <p className="copy-feedback">{copyFeedback}</p>}
            <ul className="skills-list">
              {skills.map((skill, i) => (
                <li key={i}>{skill}</li>
              ))}
            </ul>
          </div>

          {skillMatch && (
            <div className="result-box match-box">
              <h3>Job Match Analysis</h3>
              <div className="match-stats">
                <div className="match-percentage">
                  {skillMatch.matchPercentage}% Match
                </div>
                <p>
                  Your resume matches <strong>{skillMatch.matchedCount}/{skillMatch.totalRequired}</strong> required skills
                </p>
                {skillMatch.missingSkills.length > 0 && (
                  <div className="missing-skills">
                    <p><strong>Missing skills:</strong></p>
                    <ul>
                      {skillMatch.missingSkills.map((skill, i) => (
                        <li key={i}>{skill}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="result-box">
            <div className="result-header-small">
              <h3>Suggested Roles</h3>
              <select 
                className="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="Frontend">Frontend</option>
                <option value="Backend">Backend</option>
                <option value="Data">Data</option>
                <option value="DevOps">DevOps</option>
                <option value="Database">Database</option>
              </select>
            </div>
            <ul className="roles-list">
              {filteredRoles.length > 0 ? (
                filteredRoles.map((role, i) => (
                  <li key={i}>{role}</li>
                ))
              ) : (
                <li style={{ color: '#94a3b8' }}>No roles in this category</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
