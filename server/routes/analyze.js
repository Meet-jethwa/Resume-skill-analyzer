import express from 'express';
import { HfInference } from '@huggingface/inference';
import supabase from '../config/supabaseClient.js';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = express.Router();
const hf = new HfInference(process.env.HF_TOKEN);

const roleMap = {
  Python: ['Data Scientist', 'ML Engineer'],
  Java: ['Backend Developer', 'Software Engineer'],
  SQL: ['Data Analyst', 'Database Engineer'],
  TensorFlow: ['ML Engineer', 'AI Researcher'],
  React: ['Frontend Developer', 'Full Stack Developer'],
  Node: ['Backend Developer', 'Full Stack Developer'],
  AWS: ['Cloud Engineer', 'DevOps Engineer'],
  Docker: ['DevOps Engineer', 'Cloud Engineer'],
  JavaScript: ['Frontend Developer', 'Full Stack Developer'],
  MongoDB: ['Backend Developer', 'Database Engineer'],
  PostgreSQL: ['Database Engineer', 'Backend Developer'],
  TypeScript: ['Frontend Developer', 'Full Stack Developer'],
  Kubernetes: ['DevOps Engineer', 'Cloud Engineer'],
  Flask: ['Backend Developer', 'ML Engineer'],
  Django: ['Backend Developer', 'Full Stack Developer'],
  Git: ['Software Engineer', 'Full Stack Developer'],
  Linux: ['DevOps Engineer', 'Cloud Engineer'],
  HTML: ['Frontend Developer'],
  CSS: ['Frontend Developer'],
  C: ['Systems Engineer', 'Software Engineer'],
  'C++': ['Systems Engineer', 'Game Developer'],
};

const knownSkills = Object.keys(roleMap);

// Map skills to categories
const skillCategories = {
  'Frontend Development': ['React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'HTML', 'CSS'],
  'Backend Development': ['Node', 'Python', 'Java', 'C#', 'Flask', 'Django'],
  'Database': ['SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Firebase'],
  'Cloud & DevOps': ['AWS', 'Docker', 'Kubernetes', 'Linux', 'Azure', 'GCP'],
  'Data Science': ['Python', 'TensorFlow', 'Pandas', 'NumPy', 'Scikit-learn'],
  'Tools & Version Control': ['Git', 'GitHub', 'Webpack', 'Babel']
};

// Action keywords for scoring
const actionKeywords = [
  'developed', 'built', 'designed', 'implemented', 'created', 'engineered',
  'architected', 'optimized', 'led', 'managed', 'deployed', 'automated',
  'improved', 'delivered', 'scaled', 'maintained', 'contributed', 'refactored'
];

// Extract text from PDF
const extractTextFromPDF = async (pdfBuffer) => {
  const data = await pdfParse(pdfBuffer);
  return data.text;
};

// Skill analysis function
const analyzeSkills = async (text) => {
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keywordSkills = knownSkills.filter(skill =>
    new RegExp(`\\b${escapeRegex(skill)}\\b`, 'i').test(text)
  );

  // HF NER — catches unknown/unlisted skills
  const hfResult = await hf.tokenClassification({
    model: 'dslim/bert-base-NER',
    inputs: text,
  });

  const nerSkills = hfResult
    .filter(e => e.entity_group === 'MISC' || e.entity_group === 'ORG')
    .map(e => e.word.replace(/^##/, '').trim())
    .filter(w => w.length > 3 && /^[A-Z]/.test(w) && !w.includes('##'));

  // Merge both sources, remove duplicates
  const skills = [...new Set([...keywordSkills, ...nerSkills])];
  return skills;
};

// Calculate resume score
const calculateResumeScore = (text, skills) => {
  let score = 0;
  
  // Skill count impact (max 4 points)
  score += Math.min(skills.length, 15) * 0.27;
  
  // Skill category variety (max 3 points)
  let categoryCount = 0;
  for (const category of Object.values(skillCategories)) {
    if (category.some(s => skills.some(skill => s.toLowerCase() === skill.toLowerCase()))) {
      categoryCount++;
    }
  }
  score += Math.min(categoryCount, 6) * 0.5;
  
  // Action keywords (max 3 points)
  const actionKeywordCount = actionKeywords.filter(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(text)
  ).length;
  score += Math.min(actionKeywordCount, 10) * 0.3;
  
  return Math.min(parseFloat(score.toFixed(1)), 10);
};

// Calculate skill match score
const calculateSkillMatch = (resumeSkills, jobSkills) => {
  if (jobSkills.length === 0) return 100;
  
  const matchedSkills = resumeSkills.filter(skill =>
    jobSkills.some(jSkill => 
      skill.toLowerCase() === jSkill.toLowerCase()
    )
  );
  
  const missingSkills = jobSkills.filter(jSkill =>
    !resumeSkills.some(skill => 
      skill.toLowerCase() === jSkill.toLowerCase()
    )
  );
  
  const matchPercentage = Math.round((matchedSkills.length / jobSkills.length) * 100);
  
  return {
    matchedCount: matchedSkills.length,
    totalRequired: jobSkills.length,
    matchPercentage,
    missingSkills
  };
};

router.post('/', async (req, res) => {
  let resumeText = req.body.resumeText;
  const jobDescription = req.body.jobDescription;
  const analysisId = uuidv4();

  try {
    // Handle PDF upload
    if (req.file) {
      resumeText = await extractTextFromPDF(req.file.buffer);
    }

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: 'Resume text or PDF file is required' });
    }

    // Analyze skills
    const skills = await analyzeSkills(resumeText);

    // Generate role suggestions
    const suggestedRoles = [...new Set(
      skills.flatMap(s => roleMap[s] || [])
    )];

    // Calculate resume score
    const resumeScore = calculateResumeScore(resumeText, skills);

    // Calculate skill match if job description provided
    let skillMatch = null;
    if (jobDescription) {
      const jobSkills = await analyzeSkills(jobDescription);
      skillMatch = calculateSkillMatch(skills, jobSkills);
    }

    // Save to Supabase with unique ID
    const { error } = await supabase.from('resume_results').insert({
      id: analysisId,
      input_text: resumeText,
      detected_skills: skills,
      suggested_roles: suggestedRoles,
      resume_score: resumeScore,
      job_description: jobDescription || null,
      skill_match: skillMatch || null,
    });

    if (error) throw error;

    res.json({
      id: analysisId,
      skills,
      suggestedRoles,
      resumeScore,
      skillMatch,
      skillCount: skills.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

export default router;
