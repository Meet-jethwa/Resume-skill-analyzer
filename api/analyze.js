import { HfInference } from '@huggingface/inference';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const hf = new HfInference(process.env.HF_TOKEN);

export const config = {
  api: {
    bodyParser: false,
  },
};

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

const skillCategories = {
  'Frontend Development': ['React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'HTML', 'CSS'],
  'Backend Development': ['Node', 'Python', 'Java', 'C#', 'Flask', 'Django'],
  Database: ['SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Firebase'],
  'Cloud & DevOps': ['AWS', 'Docker', 'Kubernetes', 'Linux', 'Azure', 'GCP'],
  'Data Science': ['Python', 'TensorFlow', 'Pandas', 'NumPy', 'Scikit-learn'],
  'Tools & Version Control': ['Git', 'GitHub', 'Webpack', 'Babel'],
};

const actionKeywords = [
  'developed', 'built', 'designed', 'implemented', 'created', 'engineered',
  'architected', 'optimized', 'led', 'managed', 'deployed', 'automated',
  'improved', 'delivered', 'scaled', 'maintained', 'contributed', 'refactored',
];

const getFirstValue = (value) => (Array.isArray(value) ? value[0] : value);

const toStringValue = (value) => {
  const first = getFirstValue(value);
  if (typeof first === 'string') return first;
  if (first === undefined || first === null) return '';
  return String(first);
};

const parseRequestBody = async (req) => {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('multipart/form-data')) {
    return new Promise((resolve, reject) => {
      const form = formidable({
        multiples: false,
        keepExtensions: true,
      });

      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({ fields, files });
      });
    });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  return { fields: body, files: {} };
};

const extractTextFromPDF = async (pdfFile) => {
  const buffer = await fs.readFile(pdfFile.filepath);
  const parsed = await pdfParse(buffer);
  return parsed.text || '';
};

const analyzeSkills = async (text) => {
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keywordSkills = knownSkills.filter((skill) =>
    new RegExp(`\\b${escapeRegex(skill)}\\b`, 'i').test(text)
  );

  let nerSkills = [];
  try {
    const hfResult = await hf.tokenClassification({
      model: 'dslim/bert-base-NER',
      inputs: text,
    });

    nerSkills = hfResult
      .filter((item) => item.entity_group === 'MISC' || item.entity_group === 'ORG')
      .map((item) => item.word.replace(/^##/, '').trim())
      .filter((word) => word.length > 3 && /^[A-Z]/.test(word) && !word.includes('##'));
  } catch (error) {
    // Keep request successful with keyword extraction if HF fails temporarily.
    console.error('Hugging Face skill extraction failed:', error.message);
  }

  return [...new Set([...keywordSkills, ...nerSkills])];
};

const calculateResumeScore = (text, skills) => {
  let score = 0;

  score += Math.min(skills.length, 15) * 0.27;

  let categoryCount = 0;
  for (const categorySkills of Object.values(skillCategories)) {
    if (categorySkills.some((categorySkill) =>
      skills.some((skill) => categorySkill.toLowerCase() === skill.toLowerCase())
    )) {
      categoryCount += 1;
    }
  }
  score += Math.min(categoryCount, 6) * 0.5;

  const actionKeywordCount = actionKeywords.filter((keyword) =>
    new RegExp(`\\b${keyword}\\b`, 'i').test(text)
  ).length;
  score += Math.min(actionKeywordCount, 10) * 0.3;

  return Math.min(Number(score.toFixed(1)), 10);
};

const calculateSkillMatch = (resumeSkills, jobSkills) => {
  if (jobSkills.length === 0) {
    return {
      matchedCount: 0,
      totalRequired: 0,
      matchPercentage: 100,
      missingSkills: [],
    };
  }

  const matchedSkills = resumeSkills.filter((skill) =>
    jobSkills.some((jobSkill) => skill.toLowerCase() === jobSkill.toLowerCase())
  );

  const missingSkills = jobSkills.filter((jobSkill) =>
    !resumeSkills.some((skill) => skill.toLowerCase() === jobSkill.toLowerCase())
  );

  return {
    matchedCount: matchedSkills.length,
    totalRequired: jobSkills.length,
    matchPercentage: Math.round((matchedSkills.length / jobSkills.length) * 100),
    missingSkills,
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseRequestBody(req);

    let resumeText = toStringValue(fields.resumeText).trim();
    const jobDescription = toStringValue(fields.jobDescription).trim();

    const pdfFile = getFirstValue(files.pdf);
    if (pdfFile?.filepath) {
      resumeText = (await extractTextFromPDF(pdfFile)).trim();
    }

    if (!resumeText) {
      return res.status(400).json({ error: 'Resume text or PDF file is required' });
    }

    const skills = await analyzeSkills(resumeText);
    const suggestedRoles = [...new Set(skills.flatMap((skill) => roleMap[skill] || []))];
    const resumeScore = calculateResumeScore(resumeText, skills);

    let skillMatch = null;
    if (jobDescription) {
      const jobSkills = await analyzeSkills(jobDescription);
      skillMatch = calculateSkillMatch(skills, jobSkills);
    }

    const analysisId = uuidv4();
    const { error } = await supabase.from('resume_results').insert({
      id: analysisId,
      input_text: resumeText,
      detected_skills: skills,
      suggested_roles: suggestedRoles,
      resume_score: resumeScore,
      job_description: jobDescription || null,
      skill_match: skillMatch || null,
    });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      id: analysisId,
      skills,
      suggestedRoles,
      resumeScore,
      skillMatch,
      skillCount: skills.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
}
