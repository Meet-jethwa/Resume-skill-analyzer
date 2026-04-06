import express from 'express';
import supabase from '../config/supabaseClient.js';

const router = express.Router();

// Get all analyses
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('resume_results')
      .select('id, detected_skills, suggested_roles, resume_score, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ 
      analyses: data.map(item => ({
        ...item,
        skillCount: item.detected_skills?.length || 0,
        createdAt: new Date(item.created_at).toLocaleDateString()
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
});

// Get single analysis by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('resume_results')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Analysis not found' });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analysis', details: err.message });
  }
});

// Delete analysis by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('resume_results')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Analysis deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete analysis', details: err.message });
  }
});

export default router;
