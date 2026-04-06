import { useState, useEffect } from 'react'
import axios from 'axios'
import './History.css'

export default function History({ onBack }) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'

  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAnalysis, setSelectedAnalysis] = useState(null)
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${apiUrl}/api/history`)
      setAnalyses(res.data.analyses)
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this analysis?')) return

    try {
      await axios.delete(`${apiUrl}/api/history/${id}`)
      setAnalyses(analyses.filter(a => a.id !== id))
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to delete analysis')
    }
  }

  const handleViewDetails = (analysis) => {
    setSelectedAnalysis(analysis)
  }

  const getSkillsByCategory = (skills) => {
    const categoryMap = {
      'Frontend': ['React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'HTML', 'CSS'],
      'Backend': ['Node', 'Python', 'Java', 'C#', 'Flask', 'Django'],
      'Database': ['SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Firebase'],
      'DevOps': ['AWS', 'Docker', 'Kubernetes', 'Linux', 'Azure', 'GCP'],
      'Data Science': ['Python', 'TensorFlow', 'Pandas', 'NumPy', 'Scikit-learn'],
    };

    const filtered = {};
    Object.keys(categoryMap).forEach(cat => {
      filtered[cat] = skills.filter(s => categoryMap[cat].includes(s));
    });

    return Object.entries(filtered).filter(([_, v]) => v.length > 0);
  }

  if (selectedAnalysis) {
    return (
      <div className="history-detail">
        <button className="back-btn" onClick={() => setSelectedAnalysis(null)}>
          Back to History
        </button>
        
        <div className="detail-card">
          <h2>Analysis Details</h2>
          <div className="detail-section">
            <h3>Skills Detected ({selectedAnalysis.skillCount})</h3>
            <div className="categories">
              {getSkillsByCategory(selectedAnalysis.detected_skills).map(([cat, skills]) => (
                <div key={cat} className="category">
                  <h4>{cat}</h4>
                  <div className="skill-tags">
                    {skills.map((skill) => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedAnalysis.resume_score && (
            <div className="detail-section">
              <h3>Resume Score</h3>
              <div className="score-display">
                <div className="score-value">{selectedAnalysis.resume_score}/10</div>
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>Suggested Roles</h3>
            <ul className="roles-grid">
              {selectedAnalysis.suggested_roles.map((role, i) => (
                <li key={i}>{role}</li>
              ))}
            </ul>
          </div>

          <div className="detail-footer">
            <p className="timestamp">Created: {selectedAnalysis.createdAt}</p>
            <button 
              className="delete-btn"
              onClick={() => {
                handleDelete(selectedAnalysis.id)
                setSelectedAnalysis(null)
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h1>Resume History</h1>
        <button className="back-btn" onClick={onBack}>
          Back to Analyzer
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="loading">Loading history...</p>
      ) : analyses.length === 0 ? (
        <div className="empty-state">
          <p>No analyses yet. Start by analyzing a resume!</p>
        </div>
      ) : (
        <>
          <div className="filter-section">
            <label>Filter by skill count:</label>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">All</option>
              <option value="low">1-3 skills</option>
              <option value="medium">4-8 skills</option>
              <option value="high">9+ skills</option>
            </select>
          </div>

          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Skills</th>
                <th>Score</th>
                <th>Roles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {analyses
                .filter(a => {
                  if (filterCategory === 'low') return a.skillCount <= 3;
                  if (filterCategory === 'medium') return a.skillCount >= 4 && a.skillCount <= 8;
                  if (filterCategory === 'high') return a.skillCount >= 9;
                  return true;
                })
                .map((analysis) => (
                  <tr key={analysis.id} className="history-row">
                    <td>{analysis.createdAt}</td>
                    <td>
                      <span className="history-skill-badge">{analysis.skillCount} skills</span>
                    </td>
                    <td>
                      {analysis.resume_score ? (
                        <span className="history-score-badge">{analysis.resume_score}/10</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{analysis.suggested_roles.slice(0, 2).join(', ')}</td>
                    <td>
                      <button 
                        className="view-btn"
                        onClick={() => handleViewDetails(analysis)}
                      >
                        View
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDelete(analysis.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
