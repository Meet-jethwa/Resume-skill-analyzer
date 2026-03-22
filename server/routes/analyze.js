import express from 'express';
import { HfInference } from '@huggingface/inference';
import supabase from '../config/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

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

router.post('/', async (req, res) => {
  const { resumeText } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: 'Resume text is required' });
  }

  try {
    // Keyword matching — scan resume text for known skills
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keywordSkills = knownSkills.filter(skill =>
    new RegExp(`\\b${escapeRegex(skill)}\\b`, 'i').test(resumeText)
);

    // HF NER — catches unknown/unlisted skills
    const hfResult = await hf.tokenClassification({
      model: 'dslim/bert-base-NER',
      inputs: resumeText,
    });

    // Only take full words from NER (length > 2, no partial subwords)
    // Only keep NER words that start with a capital letter and are longer than 3 chars
// This removes subword fragments like "Ten", "sorF", "low"
const nerSkills = hfResult
  .filter(e => e.entity_group === 'MISC' || e.entity_group === 'ORG')
  .map(e => e.word.replace(/^##/, '').trim())
  .filter(w => w.length > 3 && /^[A-Z]/.test(w) && !w.includes('##'));


    // Merge both sources, remove duplicates
    const skills = [...new Set([...keywordSkills, ...nerSkills])];

    // Generate role suggestions
    const suggestedRoles = [...new Set(
      skills.flatMap(s => roleMap[s] || [])
    )];

    // Save to Supabase
    const { error } = await supabase.from('resume_results').insert({
      input_text: resumeText,
      detected_skills: skills,
      suggested_roles: suggestedRoles,
    });

    if (error) throw error;

    res.json({ skills, suggestedRoles });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

export default router;
