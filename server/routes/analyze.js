import express from 'express';
import { HfInference } from '@huggingface/inference';
import supabase from '../config/supabaseClient.js';
import dotenv from 'dotenv';
import { PDFParse } from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const router = express.Router();
const hf = process.env.HF_TOKEN ? new HfInference(process.env.HF_TOKEN) : null;
const HF_NER_MODEL = process.env.HF_NER_MODEL || 'dslim/bert-base-NER';
const HF_MIN_ENTITY_SCORE = 0.6;
const HF_MAX_CHARS_PER_REQUEST = 1800;
const HF_TERMINAL_DEBUG = process.env.HF_TERMINAL_DEBUG !== 'false';

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

const MAX_SUGGESTED_ROLES = 4;

const getSuggestedRoles = (skills) => {
  const uniqueRoles = [...new Set(
    skills.flatMap(skill => roleMap[skill] || [])
  )];

  if (uniqueRoles.includes('Full Stack Developer')) {
    return uniqueRoles
      .filter(role => role !== 'Frontend Developer' && role !== 'Backend Developer')
      .slice(0, MAX_SUGGESTED_ROLES);
  }

  return uniqueRoles.slice(0, MAX_SUGGESTED_ROLES);
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

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const skillAliases = {
  JavaScript: ['javascript', 'js'],
  TypeScript: ['typescript', 'ts'],
  Node: ['node', 'nodejs', 'node.js'],
  PostgreSQL: ['postgresql', 'postgres'],
  MongoDB: ['mongodb', 'mongo'],
  'Scikit-learn': ['scikit-learn', 'scikit learn', 'sklearn'],
  'C++': ['c++', 'cpp'],
  'C#': ['c#', 'c sharp']
};

const supportedSkills = [...new Set([
  ...knownSkills,
  ...Object.values(skillCategories).flat()
])];

const buildSkillPattern = (skill) => {
  if (skill === 'C') {
    // Single-letter skills are noisy, so only accept C in skill-like contexts.
    return /\bC(?=\s*(?:language|programming|developer|skills|,|\/|$))/i;
  }

  if (skillAliases[skill]) {
    const aliasPattern = skillAliases[skill]
      .map(alias => escapeRegex(alias).replace(/\\\s+/g, '\\s+'))
      .join('|');

    return new RegExp(`(?:^|[^a-z0-9])(?:${aliasPattern})(?:$|[^a-z0-9])`, 'i');
  }

  return new RegExp(`\\b${escapeRegex(skill).replace(/\\\s+/g, '\\s+')}\\b`, 'i');
};

const skillPatterns = supportedSkills.map(skill => ({
  skill,
  pattern: buildSkillPattern(skill)
}));

const supportedSkillLookup = new Map(
  supportedSkills.map(skill => [skill.toLowerCase(), skill])
);

const aliasToSkill = new Map(
  Object.entries(skillAliases).flatMap(([canonicalSkill, aliases]) =>
    aliases.map(alias => [alias.toLowerCase(), canonicalSkill])
  )
);

const hfAllowedEmergingSkills = new Map([
  ['fastapi', 'FastAPI'],
  ['spring boot', 'Spring Boot'],
  ['nestjs', 'NestJS'],
  ['next.js', 'Next.js'],
  ['nextjs', 'Next.js'],
  ['express.js', 'Express'],
  ['expressjs', 'Express'],
  ['pytorch', 'PyTorch'],
  ['keras', 'Keras'],
  ['opencv', 'OpenCV'],
  ['redis', 'Redis'],
  ['kafka', 'Kafka'],
  ['rabbitmq', 'RabbitMQ'],
  ['graphql', 'GraphQL'],
  ['rest api', 'REST API'],
  ['microservices', 'Microservices'],
  ['terraform', 'Terraform'],
  ['ansible', 'Ansible'],
  ['jenkins', 'Jenkins'],
  ['ci/cd', 'CI/CD'],
  ['github actions', 'GitHub Actions'],
  ['snowflake', 'Snowflake'],
  ['power bi', 'Power BI'],
  ['tableau', 'Tableau']
]);

const normalizeHfToken = (rawToken = '') => rawToken
  .replace(/^##/, '')
  .replace(/[_|]+/g, ' ')
  .replace(/[^\w+.#/\-\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const splitForHfInference = (text, maxChars = HF_MAX_CHARS_PER_REQUEST) => {
  if (text.length <= maxChars) return [text];

  const blocks = text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const chunks = [];
  let currentChunk = '';

  for (const block of blocks) {
    if (block.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }

      for (let i = 0; i < block.length; i += maxChars) {
        chunks.push(block.slice(i, i + maxChars));
      }
      continue;
    }

    const mergedLength = currentChunk.length + block.length + (currentChunk ? 1 : 0);
    if (mergedLength <= maxChars) {
      currentChunk = currentChunk ? `${currentChunk} ${block}` : block;
    } else {
      chunks.push(currentChunk);
      currentChunk = block;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

const toCanonicalSkill = (candidate) => {
  if (!candidate) return null;

  const normalized = candidate.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 2) return null;

  if (aliasToSkill.has(normalized)) return aliasToSkill.get(normalized);
  if (supportedSkillLookup.has(normalized)) return supportedSkillLookup.get(normalized);
  if (hfAllowedEmergingSkills.has(normalized)) return hfAllowedEmergingSkills.get(normalized);

  return null;
};

const createHfDebug = () => ({
  enabled: Boolean(hf),
  used: false,
  model: HF_NER_MODEL,
  minEntityScore: HF_MIN_ENTITY_SCORE,
  chunkCount: 0,
  entityCount: 0,
  hfSkillCount: 0,
  error: null,
});

// AIaaS helper: call Hugging Face hosted inference instead of running any model locally.
const getHfSkillsFromCloud = async (text) => {
  const debug = createHfDebug();
  if (!hf) return { skills: [], debug };

  const chunks = splitForHfInference(text);
  debug.used = true;
  debug.chunkCount = chunks.length;
  const hfSkills = new Set();

  for (const chunk of chunks) {
    const hfResult = await hf.tokenClassification({
      model: HF_NER_MODEL,
      inputs: chunk,
    });

    debug.entityCount += hfResult.length;

    for (const entity of hfResult) {
      if (!['MISC', 'ORG'].includes(entity.entity_group)) continue;
      if (typeof entity.score === 'number' && entity.score < HF_MIN_ENTITY_SCORE) continue;

      const normalizedEntity = normalizeHfToken(entity.word);
      const canonicalSkill = toCanonicalSkill(normalizedEntity);

      if (canonicalSkill) {
        hfSkills.add(canonicalSkill);
      }
    }
  }

  debug.hfSkillCount = hfSkills.size;
  return { skills: [...hfSkills], debug };
};

// Action keywords for scoring
const actionKeywords = [
  'developed', 'built', 'designed', 'implemented', 'created', 'engineered',
  'architected', 'optimized', 'led', 'managed', 'deployed', 'automated',
  'improved', 'delivered', 'scaled', 'maintained', 'contributed', 'refactored'
];

// Extract text from PDF
const extractTextFromPDF = async (pdfBuffer) => {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
};

// Skill analysis function
const analyzeSkills = async (text) => {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedText) {
    return {
      skills: [],
      hfDebug: createHfDebug()
    };
  }

  const detectedSkills = new Set(
    skillPatterns
      .filter(({ pattern }) => pattern.test(normalizedText))
      .map(({ skill }) => skill)
  );

  let hfDebug = createHfDebug();

  // Optional HF pass: enrich with additional technical skills, but only through strict canonical mapping.
  if (!hf) {
    return {
      skills: [...detectedSkills],
      hfDebug
    };
  }

  try {
    const hfResult = await getHfSkillsFromCloud(normalizedText);
    hfDebug = hfResult.debug;
    hfResult.skills.forEach(skill => detectedSkills.add(skill));
  } catch (error) {
    hfDebug = {
      ...hfDebug,
      used: true,
      chunkCount: splitForHfInference(normalizedText).length,
      error: error.message
    };
    console.warn('Hugging Face enrichment skipped:', error.message);
  }

  return {
    skills: [...detectedSkills],
    hfDebug
  };
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
  let jobAnalysis = null;

  try {
    // Handle PDF upload
    if (req.file) {
      resumeText = await extractTextFromPDF(req.file.buffer);
    }

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: 'Resume text or PDF file is required' });
    }

    // Analyze skills
    const resumeAnalysis = await analyzeSkills(resumeText);
    const skills = resumeAnalysis.skills;

    // Generate role suggestions
    const suggestedRoles = getSuggestedRoles(skills);

    // Calculate resume score
    const resumeScore = calculateResumeScore(resumeText, skills);

    // Calculate skill match if job description provided
    let skillMatch = null;
    if (jobDescription) {
      jobAnalysis = await analyzeSkills(jobDescription);
      const jobSkills = jobAnalysis.skills;
      skillMatch = calculateSkillMatch(skills, jobSkills);
    }

    const hfUsed = resumeAnalysis.hfDebug.used && !resumeAnalysis.hfDebug.error;
    const hfModel = resumeAnalysis.hfDebug.model;
    const hfSkillCount = resumeAnalysis.hfDebug.hfSkillCount;
    const hfDebug = {
      resume: resumeAnalysis.hfDebug,
      jobDescription: jobAnalysis ? jobAnalysis.hfDebug : null
    };

    if (HF_TERMINAL_DEBUG) {
      console.info(
        `[AIaaS] id=${analysisId} hfUsed=${hfUsed} model=${hfModel} hfSkillCount=${hfSkillCount} resumeChunks=${resumeAnalysis.hfDebug.chunkCount} resumeEntities=${resumeAnalysis.hfDebug.entityCount}`
      );

      if (resumeAnalysis.hfDebug.error) {
        console.warn(`[AIaaS] id=${analysisId} resumeError=${resumeAnalysis.hfDebug.error}`);
      }

      if (jobAnalysis?.hfDebug) {
        console.info(
          `[AIaaS] id=${analysisId} jobChunks=${jobAnalysis.hfDebug.chunkCount} jobEntities=${jobAnalysis.hfDebug.entityCount} jobHfSkillCount=${jobAnalysis.hfDebug.hfSkillCount}`
        );

        if (jobAnalysis.hfDebug.error) {
          console.warn(`[AIaaS] id=${analysisId} jobError=${jobAnalysis.hfDebug.error}`);
        }
      }
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
      skillCount: skills.length,
      hfUsed,
      hfModel,
      hfSkillCount,
      hfDebug
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

export default router;
